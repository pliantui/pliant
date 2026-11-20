import { functionCatalog, type Expression } from "@pliantui/contract"

import {
  createObservedChecker,
  type ExpressionCheckerOptions,
} from "./check-expression"
import { isFunctionName } from "./check-function-call"
import type { Inferred } from "./expression-types"
import { finite, readField, readTime, type Value } from "./read-value"
import { failure, type Issue, type Result } from "./result"
import type { Call } from "./row-function"
import { rowFunctions } from "./row-functions"
import { createTimeZone, dayMs, type TimeZone } from "./time-zone"

/**
 * The value of an expression for one row. A date is written `YYYY-MM-DD` and
 * a datetime as an ISO 8601 date-time in UTC with milliseconds.
 *
 * @experimental
 */
export type RowValue = string | number | boolean | null

/**
 * Reads an expression's value from one row, like a TanStack Table
 * `accessorFn`.
 *
 * @experimental
 */
export type RowAccessor = (row: object) => RowValue

/**
 * What row expressions are evaluated against.
 *
 * @experimental
 */
export interface RowEvaluatorOptions extends Omit<
  ExpressionCheckerOptions,
  "aggregates"
> {
  /**
   * The dataset's IANA time zone. Dates and datetimes are read in it, and a
   * date compared with a datetime is the start of that day there.
   */
  readonly timeZone: string
  /**
   * The time zone `today` reads the current date in, by derived field id,
   * where it isn't the dataset's: the viewer's for a derived field defined
   * in a personal or session layer.
   */
  readonly todayTimeZones?: Readonly<Record<string, string>> | undefined
  /** The current time in milliseconds since the epoch. Defaults to `Date.now`. */
  readonly now?: (() => number) | undefined
}

/**
 * Options for one expression.
 *
 * @experimental
 */
export interface RowAccessorOptions {
  /**
   * The time zone `today` reads the current date in for this expression.
   * Defaults to the dataset's.
   */
  readonly todayTimeZone?: string | undefined
}

/**
 * Checks a row expression and returns its accessor, or the issues that keep
 * it from being evaluated.
 *
 * @experimental
 */
export type RowEvaluator = (
  expression: Expression,
  options?: RowAccessorOptions
) => Result<RowAccessor>

type Run = (scope: Scope) => Value

interface Scope {
  readonly row: object
  /** The values of the derived fields this row has computed, by id. */
  readonly values: Map<string, Value>
}

interface Compiled {
  readonly run: Run
  /** The derived fields it refs, with the path of each `ref`. */
  readonly refs: { readonly id: string; readonly path: Issue["path"] }[]
  readonly issues: Issue[]
}

interface Item extends Compiled {
  /** Whether it uses a window function, directly or by `ref`. */
  window?: boolean
}

interface Compiler extends Omit<Compiled, "run"> {
  readonly fields: RowEvaluatorOptions["fields"]
  readonly types: WeakMap<Expression, Inferred>
  readonly call: Omit<Call, "types">
}

const constant =
  (value: Value): Run =>
  () =>
    value

const windowMessage =
  "a window function, which needs every row of its partition"

function own<T>(record: Readonly<Record<string, T>> | undefined, id: string) {
  return record && Object.hasOwn(record, id) ? record[id] : undefined
}

// Reads an argument as the type its call reads it as: a string literal as a
// date or datetime, or a date as the datetime its day starts at.
function compileArg(
  compiler: Compiler,
  node: Expression,
  path: readonly PropertyKey[],
  to: Inferred["type"] | undefined
): Run {
  const { zone } = compiler.call
  if ((to === "date" || to === "datetime") && "value" in node) {
    return constant(readTime(node.value, to, zone))
  }
  const run = compile(compiler, node, path)
  return to === "datetime" && compiler.types.get(node)?.type === "date"
    ? (scope) => {
        const day = run(scope)
        return day === null ? null : zone.instant(Number(day) * dayMs)
      }
    : run
}

function compile(
  compiler: Compiler,
  node: Expression,
  path: readonly PropertyKey[]
): Run {
  if ("field" in node) {
    const id = node.field
    const field = own(compiler.fields, id)
    return ({ row }) =>
      field && Object.hasOwn(row, id)
        ? readField(field, Reflect.get(row, id), compiler.call.zone)
        : null
  }
  if ("ref" in node) {
    const id = node.ref
    compiler.refs.push({ id, path: [...path, "ref"] })
    return ({ values }) => values.get(id) ?? null
  }
  if ("value" in node) {
    const { value } = node
    return constant(typeof value === "number" ? finite(value) : value)
  }
  const name = node.fn
  const implementation = isFunctionName(name) ? rowFunctions[name] : undefined
  // The checker has rejected aggregate functions in a row expression.
  if (!implementation) {
    compiler.issues.push({
      path: [...path, "fn"],
      message: `${name} is ${windowMessage}`,
    })
    return constant(null)
  }
  const types = compiler.types.get(node)?.reads ?? []
  const args = node.args.map((arg, index) =>
    compileArg(compiler, arg, [...path, "args", index], types[index])
  )
  const call = { ...compiler.call, types }
  const propagates =
    isFunctionName(name) &&
    functionCatalog.functions[name].nulls === "propagate"
  return (scope) => {
    const values = args.map((run) => run(scope))
    const result =
      propagates && values.includes(null) ? null : implementation(values, call)
    return typeof result === "number" ? finite(result) : result
  }
}

function output(value: Value, type: Inferred["type"] | undefined): RowValue {
  if (value === null || (type !== "date" && type !== "datetime")) {
    return value
  }
  const iso = new Date(
    Number(value) * (type === "date" ? dayMs : 1)
  ).toISOString()
  return type === "date" ? iso.slice(0, -14) : iso
}

/**
 * Creates an evaluator for row expressions: those of derived fields and
 * highlights. It checks each expression as `createExpressionChecker` does,
 * then returns an accessor that computes it from a row by the function
 * catalog's semantics. A derived field that a `ref` names is computed once
 * per row, however many times it's referenced. An expression that uses a
 * window function, directly or by `ref`, fails: its value depends on every
 * row of its partition. Expressions are interpreted; no code is generated.
 *
 * Throws a `RangeError` for a time zone the runtime doesn't know.
 *
 * @experimental
 */
export function createRowEvaluator(options: RowEvaluatorOptions): RowEvaluator {
  const types = new WeakMap<Expression, Inferred>()
  const check = createObservedChecker(options, (node, type) => {
    types.set(node, type)
  })
  const zones = new Map<string, TimeZone>()
  const zoneOf = (timeZone = options.timeZone) => {
    const zone = zones.get(timeZone) ?? createTimeZone(timeZone)
    zones.set(timeZone, zone)
    return zone
  }
  const zone = zoneOf()
  const clock = { now: 0 }
  const items = new Map<string, Item>()

  const compileRoot = (
    expression: Expression,
    todayTimeZone: string | undefined
  ): Compiled => {
    const todayZone = zoneOf(todayTimeZone)
    const compiler: Compiler = {
      fields: options.fields,
      types,
      refs: [],
      issues: [],
      call: {
        zone,
        today: () => Math.floor(todayZone.wallClock(clock.now) / dayMs),
      },
    }
    return { ...compiler, run: compile(compiler, expression, []) }
  }

  const itemOf = (id: string): Item => {
    const item =
      items.get(id) ??
      compileRoot(
        own(options.derived, id) ?? { value: null },
        own(options.todayTimeZones, id)
      )
    items.set(id, item)
    return item
  }

  // Derived fields are put in dependency order from an explicit stack rather
  // than by recursion, so a long chain of refs can't overflow the call stack.
  const orderOf = (root: Compiled) => {
    const order = new Map<string, Item>()
    const stack = root.refs.map(({ id }) => ({ id, ready: false }))
    for (let next = stack.pop(); next; next = stack.pop()) {
      const { id, ready } = next
      const item = itemOf(id)
      if (ready) {
        item.window ??=
          item.issues.length > 0 ||
          item.refs.some((ref) => itemOf(ref.id).window)
        order.set(id, item)
      } else if (!order.has(id)) {
        stack.push(
          { id, ready: true },
          ...item.refs.map((ref) => ({ id: ref.id, ready: false }))
        )
      }
    }
    return [...order]
  }

  return (expression, { todayTimeZone } = {}) => {
    const checked = check(expression, "row")
    if (!checked.success) {
      return checked
    }
    const root = compileRoot(expression, todayTimeZone)
    const order = orderOf(root)
    const issues = [
      ...root.issues,
      ...root.refs
        .filter(({ id }) => itemOf(id).window)
        .map(({ id, path }) => ({
          path,
          message: `${id} uses ${windowMessage}`,
        })),
    ]
    if (issues.length > 0) {
      return failure(issues)
    }
    const now = options.now ?? Date.now
    return {
      success: true,
      data: (row) => {
        clock.now = now()
        const values = new Map<string, Value>()
        for (const [id, item] of order) {
          values.set(id, item.run({ row, values }))
        }
        return output(root.run({ row, values }), checked.data.type)
      },
    }
  }
}
