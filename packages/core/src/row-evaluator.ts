import type { Expression } from "@pliantui/contract"

import {
  createObservedChecker,
  type ExpressionCheckerOptions,
} from "./check-expression"
import type { Inferred } from "./expression-types"
import { finite, inRange, readField, readTime, type Value } from "./read-value"
import { failure, type Issue, type Result } from "./result"
import type { Call } from "./row-function"
import { rowFunctionOf } from "./row-functions"
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
export type RowAccessor<TRow extends object = object> = (row: TRow) => RowValue

/**
 * What row expressions are evaluated against.
 *
 * @experimental
 */
export interface RowEvaluatorOptions<TRow extends object = object> extends Omit<
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
  /**
   * Reads a field's value from a row, like a TanStack Table `accessorFn`:
   * use it for nested values, or to convert values the evaluator doesn't
   * read, such as a `bigint`, a decimal object or a numeric string, to a
   * number. By default, the row's property named by the field id is read,
   * own or inherited.
   *
   * Values are read by the field's type: numbers as finite JavaScript
   * numbers, text and booleans as themselves, and dates and datetimes from
   * ISO 8601 text or a `Date`. A `Date` in a date field is its UTC calendar
   * date, as database drivers return date columns. A value that doesn't fit,
   * such as an epoch number in a date field, is null.
   */
  readonly getValue?: ((row: TRow, fieldId: string) => unknown) | undefined
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
export type RowEvaluator<TRow extends object = object> = (
  expression: Expression,
  options?: RowAccessorOptions
) => Result<RowAccessor<TRow>>

type Run = (scope: Scope) => Value

interface Scope {
  /** Reads a field's value from the row. */
  readonly read: (fieldId: string) => unknown
  /** The values of the derived fields this row has computed, by id. */
  readonly values: Map<string, Value>
}

interface Compiled {
  readonly run: Run
  /** The derived fields it refs. */
  readonly refs: string[]
  readonly issues: Issue[]
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

// Reads own and inherited properties, getters included, as TanStack Table's
// accessorKey does. What every object inherits from Object.prototype is a
// function or an object, which no field type accepts, so it reads as null.
function readProperty(row: object, id: string): unknown {
  return Reflect.get(row, id)
}

function isDateType(type: Inferred["type"] | undefined) {
  return type === "date" || type === "datetime"
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
    return ({ read }) =>
      field ? readField(field, read(id), compiler.call.zone) : null
  }
  if ("ref" in node) {
    const id = node.ref
    compiler.refs.push(id)
    if (compiler.types.get(node)?.window) {
      compiler.issues.push({
        path: [...path, "ref"],
        message: `${id} uses ${windowMessage}`,
      })
    }
    return ({ values }) => values.get(id) ?? null
  }
  if ("value" in node) {
    const { value } = node
    return constant(typeof value === "number" ? finite(value) : value)
  }
  const name = node.fn
  const definition = rowFunctionOf(name)
  // The checker has rejected aggregate functions in a row expression.
  if (!definition) {
    compiler.issues.push({
      path: [...path, "fn"],
      message: `${name} is ${windowMessage}`,
    })
    return constant(null)
  }
  const { run, propagates } = definition
  const inferred = compiler.types.get(node)
  const types = inferred?.reads ?? []
  const args = node.args.map((arg, index) =>
    compileArg(compiler, arg, [...path, "args", index], types[index])
  )
  const call = { ...compiler.call, types }
  const type = inferred?.type
  return (scope) => {
    const values = args.map((arg) => arg(scope))
    const result =
      propagates && values.includes(null) ? null : run(values, call)
    if (typeof result !== "number") {
      return result
    }
    return type === "date" || type === "datetime"
      ? inRange(result, type)
      : finite(result)
  }
}

function output(value: Value, type: Inferred["type"] | undefined): RowValue {
  if (value === null || !isDateType(type)) {
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
 * Dates and datetimes are kept to the years 0000 to 9999: one computed
 * outside them is null.
 *
 * Throws a `RangeError` when `timeZone` or a value of `todayTimeZones` isn't
 * a time zone the runtime knows.
 *
 * @experimental
 */
export function createRowEvaluator<TRow extends object = object>(
  options: RowEvaluatorOptions<TRow>
): RowEvaluator<TRow> {
  const types = new WeakMap<Expression, Inferred>()
  const check = createObservedChecker(options, (node, type) => {
    types.set(node, type)
  })
  const clock = { now: 0 }
  const zones = new Map<
    string,
    { zone: TimeZone; today: () => number | null }
  >()
  // Each zone remembers its current date for the last time read, so rows
  // read at the same time don't each convert it.
  const zoneOf = (timeZone = options.timeZone) => {
    let entry = zones.get(timeZone)
    if (!entry) {
      const zone = createTimeZone(timeZone)
      let readAt = Number.NaN
      let day: number | null = null
      const today = () => {
        if (clock.now !== readAt) {
          readAt = clock.now
          day =
            inRange(readAt, "datetime") === null
              ? null
              : Math.floor(zone.wallClock(readAt) / dayMs)
        }
        return day
      }
      entry = { zone, today }
      zones.set(timeZone, entry)
    }
    return entry
  }
  const { zone } = zoneOf()
  for (const timeZone of Object.values(options.todayTimeZones ?? {})) {
    zoneOf(timeZone)
  }
  const items = new Map<string, Compiled>()
  const getValue = options.getValue ?? readProperty

  const compileRoot = (
    expression: Expression,
    todayTimeZone: string | undefined
  ): Compiled => {
    const compiler: Compiler = {
      fields: options.fields,
      types,
      refs: [],
      issues: [],
      call: { zone, today: zoneOf(todayTimeZone).today },
    }
    return { ...compiler, run: compile(compiler, expression, []) }
  }

  const itemOf = (id: string) => {
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
    const order = new Map<string, Compiled>()
    const stack = root.refs.map((id) => ({ id, ready: false }))
    for (let next = stack.pop(); next; next = stack.pop()) {
      const { id, ready } = next
      const item = itemOf(id)
      if (ready) {
        order.set(id, item)
      } else if (!order.has(id)) {
        stack.push(
          { id, ready: true },
          ...item.refs.map((ref) => ({ id: ref, ready: false }))
        )
      }
    }
    return [...order]
  }

  return (expression, { todayTimeZone } = {}) => {
    try {
      zoneOf(todayTimeZone)
    } catch {
      return failure([
        { path: [], message: `Unknown time zone ${String(todayTimeZone)}` },
      ])
    }
    const checked = check(expression, "row")
    if (!checked.success) {
      return checked
    }
    const root = compileRoot(expression, todayTimeZone)
    if (root.issues.length > 0) {
      return failure(root.issues)
    }
    const order = orderOf(root)
    const now = options.now ?? Date.now
    return {
      success: true,
      data: (row) => {
        clock.now = now()
        const scope: Scope = {
          read: (id) => getValue(row, id),
          values: new Map(),
        }
        for (const [id, item] of order) {
          scope.values.set(id, item.run(scope))
        }
        return output(root.run(scope), checked.data.type)
      },
    }
  }
}
