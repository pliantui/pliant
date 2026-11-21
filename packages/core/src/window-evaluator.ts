import type { Expression } from "@pliantui/contract"

import type { ExpressionType } from "./check-expression"
import { compareCodePoints } from "./compare-code-points"
import {
  createContext,
  dependencyOrder,
  own,
  type CompileCall,
  type Compiled,
  type Run,
  type Scope,
} from "./expression-compiler"
import type { Value } from "./read-value"
import { failure, type Issue, type Result } from "./result"
import {
  output,
  type RowEvaluatorOptions,
  type RowExpressionOptions,
  type RowValue,
} from "./row-evaluator"
import { windowFunctionOf, type WindowFunction } from "./window-functions"

/**
 * What window expressions are evaluated against.
 *
 * @experimental
 */
export interface WindowEvaluatorOptions<
  TRow extends object = object,
> extends RowEvaluatorOptions<TRow> {
  /**
   * The row key, like TanStack Table's `getRowId`. By default, it's the
   * row's field named `id`, as text.
   */
  readonly getRowId?: ((row: TRow) => string) | undefined
}

/**
 * Options for computing an expression over one partition.
 *
 * @experimental
 */
export interface WindowPartitionOptions<TRow extends object = object> {
  /**
   * The table's current sort, as a comparator that gives 0 for rows it
   * ties. Display order is this order, with ties, or every row when it's
   * left out, in ascending order of the row key compared by code point.
   */
  readonly compare?: ((a: TRow, b: TRow) => number) | undefined
}

/**
 * An expression ready to compute over the rows of a partition, and the type
 * and unit of its value as `createExpressionChecker` gives them.
 *
 * @experimental
 */
export interface WindowExpression<
  TRow extends object = object,
> extends ExpressionType {
  /**
   * Computes the expression for every row of a partition: the rows of a
   * group when the table is grouped, otherwise every row after filters.
   * Rows can be given in any order; the values come back in the same order.
   */
  readonly evaluate: (
    rows: readonly TRow[],
    options?: WindowPartitionOptions<TRow>
  ) => RowValue[]
}

/**
 * Checks a row expression, which may use window functions, and returns it
 * ready to compute, or the issues that keep it from being evaluated.
 *
 * @experimental
 */
export type WindowEvaluator<TRow extends object = object> = (
  expression: Expression,
  options?: RowExpressionOptions
) => Result<WindowExpression<TRow>>

interface CallPlan {
  readonly window: WindowFunction
  readonly arg: Run
}

const noValue: Run = () => null

/**
 * Creates an evaluator for row expressions that use window functions, such
 * as `share(revenue)` or `lte(rank(score), 10)`, which give each row a value
 * computed over its partition. It checks each expression as
 * `createExpressionChecker` does, then returns a function that computes it
 * for every row of a partition by the function catalog's semantics. Window
 * function arguments and the rest of the expression are evaluated as
 * `createRowEvaluator` does, and an expression without window functions
 * gives what its row accessor gives.
 *
 * Running sums and totals are compensated, and means and deviations are
 * accumulated by Welford's algorithm merged pairwise by Chan's, on values
 * scaled by a power of two so that they can't overflow, so results stay
 * within the catalog's floating-point allowances at any number of rows.
 *
 * Throws a `RangeError` when `timeZone` or a value of `todayTimeZones` isn't
 * a time zone the runtime knows.
 *
 * @experimental
 */
export function createWindowEvaluator<TRow extends object = object>(
  options: WindowEvaluatorOptions<TRow>
): WindowEvaluator<TRow> {
  const context = createContext(options)
  const rowKey =
    options.getRowId ?? ((row: TRow) => String(context.getValue(row, "id")))

  return (expression, { todayTimeZone } = {}) => {
    const timeZone = todayTimeZone ?? options.timeZone
    if (!context.knowsZone(timeZone)) {
      return failure([{ path: [], message: `Unknown time zone "${timeZone}"` }])
    }
    const checked = context.check(expression, "row")
    if (!checked.success) {
      return checked
    }

    const calls: CallPlan[] = []
    const issues: Issue[] = []
    const argRefs: string[] = []
    const compileWith = (node: Expression, zone: string | undefined) => {
      const compileCall: CompileCall = (call, path) => {
        const create = windowFunctionOf(call.fn)
        const compiled = context.compileArgs(call, path, zone)
        issues.push(...compiled.issues)
        argRefs.push(...compiled.refs)
        // The checker allows only window functions here.
        if (!create) return noValue
        const index = calls.length
        const order = call.args[1]
        calls.push({
          window: create(
            order !== undefined && "value" in order && order.value === "asc"
          ),
          arg: compiled.args[0] ?? noValue,
        })
        return (scope) => scope.calls[index] ?? null
      }
      const compiled = context.compile(node, zone, compileCall)
      issues.push(...compiled.issues)
      return compiled
    }

    const root = compileWith(expression, todayTimeZone)
    const items = new Map<string, Compiled>()
    const order = dependencyOrder(root.refs, (id) => {
      const item =
        items.get(id) ??
        compileWith(
          own(options.derived, id) ?? { value: null },
          own(options.todayTimeZones, id)
        )
      items.set(id, item)
      return item
    })
    if (issues.length > 0) {
      return failure(issues)
    }
    const argOrder = context.derivedOrder(argRefs)

    return {
      success: true,
      data: {
        ...checked.data,
        evaluate: (rows, { compare } = {}) => {
          context.tick()
          let current: TRow | undefined
          const scope: Scope = {
            read: (id) => (current ? context.getValue(current, id) : null),
            values: new Map(),
            calls: [],
          }
          const runAll = (runs: readonly [string, Compiled][]) => {
            for (const [id, item] of runs) {
              scope.values.set(id, item.run(scope))
            }
          }

          let displayOrder: number[] | undefined
          const displayOrderOf = () => {
            displayOrder ??= rows
              .map((row, index) => ({ row, index, key: rowKey(row) }))
              .sort(
                (a, b) =>
                  (compare?.(a.row, b.row) ?? 0) ||
                  compareCodePoints(a.key, b.key)
              )
              .map(({ index }) => index)
            return displayOrder
          }

          const running = calls.map((plan) => ({
            ...plan,
            values: [] as Value[],
          }))
          for (const row of rows) {
            current = row
            runAll(argOrder)
            for (const { arg, values } of running) {
              values.push(arg(scope))
            }
          }
          const results = running.map(({ window, values }) =>
            window(values, displayOrderOf)
          )

          const rowCalls: Value[] = []
          scope.calls = rowCalls
          return rows.map((row, index) => {
            current = row
            results.forEach((values, call) => {
              rowCalls[call] = values[index] ?? null
            })
            runAll(order)
            return output(root.run(scope), checked.data.type)
          })
        },
      },
    }
  }
}
