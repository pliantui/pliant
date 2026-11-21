import type { Expression } from "@pliantui/contract"

import { aggregationOf, type Aggregation } from "./aggregations"
import type {
  ExpressionCheckerOptions,
  ExpressionType,
} from "./check-expression"
import {
  createContext,
  dependencyOrder,
  own,
  type CompileCall,
  type Compiled,
  type Run,
  type Scope,
} from "./expression-compiler"
import { finite, type Value } from "./read-value"
import { failure, type Issue, type Result } from "./result"
import {
  output,
  type RowEvaluatorOptions,
  type RowExpressionOptions,
  type RowValue,
} from "./row-evaluator"

/**
 * What aggregate expressions are evaluated against.
 *
 * @experimental
 */
export interface AggregateEvaluatorOptions<TRow extends object = object>
  extends
    RowEvaluatorOptions<TRow>,
    Pick<ExpressionCheckerOptions, "aggregates"> {
  /**
   * The time zone `today` reads the current date in, by aggregate id, where
   * it isn't the dataset's: the viewer's for an aggregate defined in a
   * personal or session layer.
   */
  readonly aggregateTodayTimeZones?:
    Readonly<Record<string, string>> | undefined
}

/**
 * An aggregate expression ready to compute over the rows of a group, and
 * the type and unit of its value as `createExpressionChecker` gives them.
 *
 * @experimental
 */
export interface AggregateExpression<
  TRow extends object = object,
> extends ExpressionType {
  /**
   * Computes the expression over a group's rows, given in display order,
   * which `first` and `last` read.
   */
  readonly aggregate: (rows: Iterable<TRow>) => RowValue
}

/**
 * Checks an aggregate expression and returns it ready to compute, or the
 * issues that keep it from being evaluated.
 *
 * @experimental
 */
export type AggregateEvaluator<TRow extends object = object> = (
  expression: Expression,
  options?: RowExpressionOptions
) => Result<AggregateExpression<TRow>>

interface CallPlan {
  readonly create: () => Aggregation
  readonly args: readonly Run[]
}

function constantNumber(node: Expression | undefined) {
  return node && "value" in node && typeof node.value === "number"
    ? node.value
    : 0.5
}

/**
 * Creates an evaluator for aggregate expressions: those of aggregates, which
 * compute one value from every row of a group, such as
 * `div(sum(revenue), count())`. It checks each expression as
 * `createExpressionChecker` does, then returns a function that computes it
 * over a group's rows by the function catalog's semantics. Arguments of
 * aggregate functions are row expressions, evaluated as `createRowEvaluator`
 * does, and an aggregate that a `ref` names is computed once per group.
 *
 * Sums are compensated, and means and variances are accumulated by
 * Welford's algorithm in short runs merged pairwise by Chan's, so results
 * stay within the catalog's floating-point allowances at any number of
 * rows. Medians, percentiles, modes and distinct counts hold every value of
 * the group while it's computed.
 *
 * Throws a `RangeError` when `timeZone` or a value of `todayTimeZones` or
 * `aggregateTodayTimeZones` isn't a time zone the runtime knows.
 *
 * @experimental
 */
export function createAggregateEvaluator<TRow extends object = object>(
  options: AggregateEvaluatorOptions<TRow>
): AggregateEvaluator<TRow> {
  const context = createContext(options, options.aggregateTodayTimeZones)

  return (expression, { todayTimeZone } = {}) => {
    const timeZone = todayTimeZone ?? options.timeZone
    if (!context.knowsZone(timeZone)) {
      return failure([{ path: [], message: `Unknown time zone "${timeZone}"` }])
    }
    const checked = context.check(expression, "aggregate")
    if (!checked.success) {
      return checked
    }

    const calls: CallPlan[] = []
    const issues: Issue[] = []
    const rowRefs: string[] = []
    const groupOf = (node: Expression, zone: string | undefined) => {
      const compileCall: CompileCall = (call, path) => {
        const create = aggregationOf(call.fn)
        const compiled = context.compileArgs(call, path, zone)
        issues.push(...compiled.issues)
        rowRefs.push(...compiled.refs)
        // The checker allows only aggregate functions here.
        if (!create) return () => null
        const index = calls.length
        const p = constantNumber(call.args[1])
        calls.push({ create: () => create(p), args: compiled.args })
        return (scope) => scope.calls[index] ?? null
      }
      const compiled = context.compile(node, zone, compileCall)
      issues.push(...compiled.issues)
      return compiled
    }

    const root = groupOf(expression, todayTimeZone)
    const items = new Map<string, Compiled>()
    const order = dependencyOrder(root.refs, (id) => {
      const item =
        items.get(id) ??
        groupOf(
          own(options.aggregates, id) ?? { value: null },
          own(options.aggregateTodayTimeZones, id)
        )
      items.set(id, item)
      return item
    })
    if (issues.length > 0) {
      return failure(issues)
    }
    const derived = context.derivedOrder(rowRefs)

    return {
      success: true,
      data: {
        ...checked.data,
        aggregate: (rows) => {
          context.tick()
          const running = calls.map(({ create, args }) => ({
            aggregation: create(),
            args,
            values: args.map((): Value => null),
          }))
          let current: TRow | undefined
          const rowScope: Scope = {
            read: (id) => (current ? context.getValue(current, id) : null),
            values: new Map(),
            calls: [],
          }
          for (const row of rows) {
            current = row
            for (const [id, item] of derived) {
              rowScope.values.set(id, item.run(rowScope))
            }
            // Reusing each call's argument list keeps millions of rows from
            // allocating one per row.
            for (const { aggregation, args, values } of running) {
              for (let index = 0; index < args.length; index++) {
                values[index] = args[index]?.(rowScope) ?? null
              }
              aggregation.add(values)
            }
          }
          const groupScope: Scope = {
            read: () => null,
            values: new Map<string, Value>(),
            calls: running.map(({ aggregation }) => {
              const value = aggregation.result()
              return typeof value === "number" ? finite(value) : value
            }),
          }
          for (const [id, item] of order) {
            groupScope.values.set(id, item.run(groupScope))
          }
          return output(root.run(groupScope), checked.data.type)
        },
      },
    }
  }
}
