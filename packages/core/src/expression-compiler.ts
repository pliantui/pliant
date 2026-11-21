import type { Expression } from "@pliantui/contract"

import {
  createObservedChecker,
  type ExpressionChecker,
  type ExpressionCheckerOptions,
  type ExpressionField,
} from "./check-expression"
import type { Inferred } from "./expression-types"
import { finite, inRange, readField, readTime, type Value } from "./read-value"
import type { Issue } from "./result"
import type { Call } from "./row-function"
import { rowFunctionOf } from "./row-functions"
import { createTimeZone, dayMs, type TimeZone } from "./time-zone"

export type Run = (scope: Scope) => Value

export interface Scope {
  /** Reads a field's value from the row. */
  read: (fieldId: string) => unknown
  /**
   * The values computed so far, by id: a row's derived fields, or a group's
   * aggregates.
   */
  readonly values: Map<string, Value>
  /** A group's aggregate function results, by the order they compiled in. */
  calls: readonly Value[]
}

export interface Compiled {
  readonly run: Run
  /** The ids its refs name. */
  readonly refs: string[]
  readonly issues: Issue[]
}

type FunctionCall = Extract<Expression, { fn: string }>

/** Compiles an aggregate function call of a group expression. */
export type CompileCall = (
  node: FunctionCall,
  path: readonly PropertyKey[]
) => Run

interface Compiler extends Omit<Compiled, "run"> {
  readonly fields: Readonly<Record<string, ExpressionField>>
  readonly types: WeakMap<Expression, Inferred>
  readonly call: Omit<Call, "types">
  readonly compileCall: CompileCall | undefined
}

export interface ContextOptions<
  TRow extends object,
> extends ExpressionCheckerOptions {
  readonly timeZone: string
  readonly todayTimeZones?: Readonly<Record<string, string>> | undefined
  readonly now?: (() => number) | undefined
  readonly getValue?: ((row: TRow, fieldId: string) => unknown) | undefined
}

const constant =
  (value: Value): Run =>
  () =>
    value

const windowMessage =
  "a window function, which needs every row of its partition"

export function own<T>(
  record: Readonly<Record<string, T>> | undefined,
  id: string
) {
  return record && Object.hasOwn(record, id) ? record[id] : undefined
}

// Reads own and inherited properties, getters included, as TanStack Table's
// accessorKey does. What every object inherits from Object.prototype is a
// function or an object, which no field type accepts, so it reads as null.
function readProperty(row: object, id: string): unknown {
  return Reflect.get(row, id)
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

function compileArgs(
  compiler: Compiler,
  node: FunctionCall,
  path: readonly PropertyKey[]
) {
  const types = compiler.types.get(node)?.reads ?? []
  return node.args.map((arg, index) =>
    compileArg(compiler, arg, [...path, "args", index], types[index])
  )
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
    if (compiler.types.get(node)?.window && !compiler.compileCall) {
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
  // The checker allows aggregate functions only where a group expression
  // can call them, and window functions only where a row expression can,
  // which `compileCall` compiles when the evaluator computes partitions.
  if (!definition) {
    if (compiler.compileCall) {
      return compiler.compileCall(node, path)
    }
    compiler.issues.push({
      path: [...path, "fn"],
      message: `${name} is ${windowMessage}`,
    })
    return constant(null)
  }
  const { run, propagates } = definition
  const inferred = compiler.types.get(node)
  const args = compileArgs(compiler, node, path)
  const call = { ...compiler.call, types: inferred?.reads ?? [] }
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

/**
 * What row and group expressions compile against: the checker, which
 * records each node's type, the time zones, the clock `today` reads, and
 * the derived fields, each compiled once.
 */
export interface Context<TRow extends object> {
  readonly check: ExpressionChecker
  /** Whether the runtime knows the time zone. */
  readonly knowsZone: (timeZone: string) => boolean
  /**
   * Compiles a checked expression. Without `compileCall`, it's a row
   * expression, which can't use window functions. With it, it's a group
   * expression, whose aggregate function calls it compiles, or a row
   * expression whose window function calls it compiles.
   */
  readonly compile: (
    expression: Expression,
    todayTimeZone: string | undefined,
    compileCall?: CompileCall
  ) => Compiled
  /**
   * Compiles the arguments of an aggregate or window function call as row
   * expressions.
   */
  readonly compileArgs: (
    node: FunctionCall,
    path: readonly PropertyKey[],
    todayTimeZone: string | undefined
  ) => Omit<Compiled, "run"> & { readonly args: readonly Run[] }
  /** The derived fields these refs need, in the order to compute them. */
  readonly derivedOrder: (refs: readonly string[]) => [string, Compiled][]
  /** Reads the clock, for the rows read until it's read again. */
  readonly tick: () => void
  /** Reads a field's value from a row. */
  readonly getValue: (row: TRow, fieldId: string) => unknown
}

/**
 * Items are put in dependency order from an explicit stack rather than by
 * recursion, so a long chain of refs can't overflow the call stack.
 */
export function dependencyOrder(
  refs: readonly string[],
  itemOf: (id: string) => Compiled
): [string, Compiled][] {
  const order = new Map<string, Compiled>()
  const stack = refs.map((id) => ({ id, ready: false }))
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

/**
 * Creates the context expressions compile in. Throws a `RangeError` when
 * `timeZone` or a value of `todayTimeZones` isn't a time zone the runtime
 * knows.
 */
export function createContext<TRow extends object>(
  options: ContextOptions<TRow>,
  moreTimeZones: Readonly<Record<string, string>> = {}
): Context<TRow> {
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
  for (const timeZone of [
    ...Object.values(options.todayTimeZones ?? {}),
    ...Object.values(moreTimeZones),
  ]) {
    zoneOf(timeZone)
  }
  const now = options.now ?? Date.now
  const getValue = options.getValue ?? readProperty

  const compilerOf = (
    todayTimeZone: string | undefined,
    compileCall: CompileCall | undefined
  ): Compiler => ({
    fields: options.fields,
    types,
    refs: [],
    issues: [],
    call: { zone, today: zoneOf(todayTimeZone).today },
    compileCall,
  })

  const compileExpression: Context<TRow>["compile"] = (
    expression,
    todayTimeZone,
    compileCall
  ) => {
    const compiler = compilerOf(todayTimeZone, compileCall)
    return { ...compiler, run: compile(compiler, expression, []) }
  }

  const items = new Map<string, Compiled>()
  const itemOf = (id: string) => {
    const item =
      items.get(id) ??
      compileExpression(
        own(options.derived, id) ?? { value: null },
        own(options.todayTimeZones, id)
      )
    items.set(id, item)
    return item
  }

  return {
    check,
    knowsZone: (timeZone) => {
      try {
        zoneOf(timeZone)
        return true
      } catch {
        return false
      }
    },
    compile: compileExpression,
    compileArgs: (node, path, todayTimeZone) => {
      const compiler = compilerOf(todayTimeZone, undefined)
      const args = compileArgs(compiler, node, path)
      return { refs: compiler.refs, issues: compiler.issues, args }
    },
    derivedOrder: (refs) => dependencyOrder(refs, itemOf),
    tick: () => {
      clock.now = now()
    },
    getValue,
  }
}
