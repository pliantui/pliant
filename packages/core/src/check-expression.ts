import {
  functionCatalog,
  type Expression,
  type FunctionName,
} from "@pliantui/contract"

import {
  checkFunctionCall,
  isFunctionName,
  type Report,
} from "./check-function-call"
import type { Inferred, ValueType } from "./expression-types"
import { failure, type Result } from "./result"

/**
 * A dataset field as the expression checker reads it. A `currency` field's
 * unit is its currency code, a `percent` field's unit is `percent`, and a
 * `number` or `integer` field can declare a unit.
 *
 * @experimental
 */
export type ExpressionField =
  | { readonly type: "currency"; readonly currency: string }
  | { readonly type: "number" | "integer"; readonly unit?: string | undefined }
  | {
      readonly type:
        | "string"
        | "text"
        | "percent"
        | "boolean"
        | "date"
        | "datetime"
        | "enum"
        | "id"
        | "url"
        | "email"
    }

/**
 * The type of an expression's value.
 *
 * @experimental
 */
export interface ExpressionType {
  readonly type: ValueType
  /** The unit of a number: a currency code, `percent`, or a declared unit. */
  readonly unit?: string
}

/**
 * What expressions are checked against.
 *
 * @experimental
 */
export interface ExpressionCheckerOptions {
  /** The dataset's fields, by id. */
  readonly fields: Readonly<Record<string, ExpressionField>>
  /**
   * The derived fields a `ref` can name, by id, one per id as they apply. An
   * item that overrides another replaces it here, so an item that refs its
   * own id resolves to its own entry, which is a circular reference, not to
   * the item it overrides.
   */
  readonly derived?: Readonly<Record<string, Expression>> | undefined
  /** The aggregates a `ref` can name, by id, as for `derived`. */
  readonly aggregates?: Readonly<Record<string, Expression>> | undefined
}

/**
 * `row` checks a derived field's expression, which can't use aggregate
 * functions. `aggregate` checks an aggregate's expression, which reads fields
 * and derived fields only inside aggregate functions and can't use window
 * functions.
 *
 * @experimental
 */
export type ExpressionKind = "row" | "aggregate"

/**
 * Checks one expression. Referenced items are checked once and remembered
 * for later calls.
 *
 * @experimental
 */
export type ExpressionChecker = (
  expression: Expression,
  kind: ExpressionKind
) => Result<ExpressionType>

/**
 * What `checkExpression` checks an expression against.
 *
 * @experimental
 */
export interface CheckExpressionOptions extends ExpressionCheckerOptions {
  readonly kind: ExpressionKind
}

type ItemKind = "derived" | "aggregate"

type Scope =
  | { readonly level: "row" | "group" }
  | {
      readonly level: "inner"
      /** The aggregate or window function whose arguments these are. */
      readonly within: string
    }

type Resolved =
  | { readonly type: Inferred; readonly window: boolean }
  | { readonly cause: string; readonly cycle: boolean }

interface Item {
  readonly kind: ItemKind
  readonly id: string
  readonly expression: Expression
}

/** Receives the inferred type of each node the checker reads. */
export type ObserveNode = (node: Expression, type: Inferred) => void

interface Context {
  readonly options: ExpressionCheckerOptions
  readonly observe: ObserveNode | undefined
  readonly resolved: Record<ItemKind, Map<string, Resolved | "checking">>
  /** The items being checked, each one referenced by the item before it. */
  readonly stack: Item[]
}

interface Issue {
  readonly path: readonly PropertyKey[]
  readonly message: string
  /** The root cause, which a `ref` to an invalid item reports. */
  readonly cause: string
}

interface Walk {
  readonly context: Context
  readonly issues: Issue[]
  /** Whether the expression uses a window function, directly or by `ref`. */
  window: boolean
  /** The first referenced item that isn't checked yet. */
  pending: Item | undefined
}

const valueTypes: Record<ExpressionField["type"], ValueType> = {
  string: "string",
  text: "string",
  number: "number",
  integer: "integer",
  currency: "number",
  percent: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  enum: "string",
  id: "string",
  url: "string",
  email: "string",
}

function fail(
  walk: Walk,
  path: readonly PropertyKey[],
  message: string,
  cause = message
) {
  walk.issues.push({ path, message, cause })
}

function lookup<T>(
  record: Readonly<Record<string, T>> | undefined,
  id: string
): T | undefined {
  return record && Object.hasOwn(record, id) ? record[id] : undefined
}

function definitionOf({ options }: Context, kind: ItemKind, id: string) {
  return lookup(kind === "derived" ? options.derived : options.aggregates, id)
}

function unitOf(field: ExpressionField) {
  switch (field.type) {
    case "currency":
      return field.currency
    case "percent":
      return "percent"
    case "number":
    case "integer":
      return field.unit
    default:
      return undefined
  }
}

function inferValue(value: string | number | boolean | null): Inferred {
  if (typeof value === "string") {
    return { type: "string", literal: value }
  }
  if (typeof value === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number" }
  }
  return { type: value === null ? "null" : "boolean" }
}

function inferField(
  walk: Walk,
  id: string,
  path: readonly PropertyKey[],
  scope: Scope
) {
  const field = lookup(walk.context.options.fields, id)
  if (!field) {
    fail(walk, path, `Unknown field ${id}`)
    return undefined
  }
  if (scope.level === "group") {
    fail(
      walk,
      path,
      `${id} must be inside an aggregate function in an aggregate expression`
    )
  }
  return { type: valueTypes[field.type], unit: unitOf(field) }
}

function checkTree(
  context: Context,
  expression: Expression,
  kind: ExpressionKind
) {
  const walk: Walk = { context, issues: [], window: false, pending: undefined }
  const type = infer(walk, expression, [], {
    level: kind === "row" ? "row" : "group",
  })
  if (type?.type === "null") {
    fail(walk, [], "Must have a type, not null")
  }
  return { ...walk, type }
}

function resolvedOf(
  type: Inferred | undefined,
  issues: readonly Issue[],
  window: boolean
): Resolved {
  if (type && type.type !== "null" && issues.length === 0) {
    return { type: { type: type.type, unit: type.unit }, window }
  }
  return { cause: issues[0]?.cause ?? "Invalid expression", cycle: false }
}

// Items are checked from an explicit stack rather than by recursion, so a
// long chain of refs can't overflow the call stack. An item that refs an
// unchecked item is set aside until that item is checked, then checked again.
function resolveItems(context: Context, first: Item) {
  const { stack } = context
  context.resolved[first.kind].set(first.id, "checking")
  stack.push(first)
  for (let item = stack.at(-1); item; item = stack.at(-1)) {
    const { type, issues, window, pending } = checkTree(
      context,
      item.expression,
      item.kind === "derived" ? "row" : "aggregate"
    )
    if (pending) {
      context.resolved[pending.kind].set(pending.id, "checking")
      stack.push(pending)
    } else {
      context.resolved[item.kind].set(item.id, resolvedOf(type, issues, window))
      stack.pop()
    }
  }
}

function cycleOf({ stack }: Context, kind: ItemKind, id: string): Resolved {
  const start = stack.findIndex((item) => item.kind === kind && item.id === id)
  const cycle = [...stack.slice(start).map((item) => item.id), id]
  return { cause: `Circular reference: ${cycle.join(" → ")}`, cycle: true }
}

function misplacedMessage(id: string, scope: Scope) {
  switch (scope.level) {
    case "group":
      return `${id} is a derived field, which an aggregate expression can use only inside an aggregate function`
    case "row":
      return `${id} is an aggregate, which a row expression can't use`
    case "inner":
      return `${id} is an aggregate, which can't be nested in ${scope.within}`
  }
}

function inferRef(
  walk: Walk,
  id: string,
  path: readonly PropertyKey[],
  scope: Scope
) {
  const { context } = walk
  const kind = scope.level === "group" ? "aggregate" : "derived"
  const expression = definitionOf(context, kind, id)
  if (!expression) {
    const other = kind === "derived" ? "aggregate" : "derived"
    fail(
      walk,
      path,
      definitionOf(context, other, id)
        ? misplacedMessage(id, scope)
        : `Unknown derived field or aggregate ${id}`
    )
    return undefined
  }
  const known = context.resolved[kind].get(id)
  if (known === undefined) {
    walk.pending ??= { kind, id, expression }
    return undefined
  }
  const resolved = known === "checking" ? cycleOf(context, kind, id) : known
  if ("cause" in resolved) {
    const { cause, cycle } = resolved
    fail(walk, path, cycle ? cause : `${id} is invalid: ${cause}`, cause)
    return undefined
  }
  if (resolved.window) {
    if (scope.level === "inner") {
      fail(
        walk,
        path,
        `${id} uses a window function, which can't be nested in ${scope.within}`
      )
    }
    walk.window = true
  }
  return resolved.window ? { ...resolved.type, window: true } : resolved.type
}

function argumentScope(
  walk: Walk,
  name: FunctionName,
  path: readonly PropertyKey[],
  scope: Scope
): Scope {
  const { kind } = functionCatalog.functions[name]
  if (kind === "row") {
    return scope
  }
  if (kind === "window") {
    walk.window = true
  }
  const article = kind === "aggregate" ? "an" : "a"
  if (scope.level === "inner") {
    fail(
      walk,
      path,
      `${name} is ${article} ${kind} function, which can't be nested in ${scope.within}`
    )
  } else if (kind === "aggregate" && scope.level === "row") {
    fail(
      walk,
      path,
      `${name} is an aggregate function, which a row expression can't use`
    )
  } else if (kind === "window" && scope.level === "group") {
    fail(
      walk,
      path,
      `${name} is a window function, which an aggregate expression can't use`
    )
  }
  return { level: "inner", within: name }
}

function infer(
  walk: Walk,
  node: Expression,
  path: readonly PropertyKey[],
  scope: Scope
): Inferred | undefined {
  const type = inferNode(walk, node, path, scope)
  if (type) {
    walk.context.observe?.(node, type)
  }
  return type
}

function inferNode(
  walk: Walk,
  node: Expression,
  path: readonly PropertyKey[],
  scope: Scope
): Inferred | undefined {
  if ("field" in node) {
    return inferField(walk, node.field, [...path, "field"], scope)
  }
  if ("ref" in node) {
    return inferRef(walk, node.ref, [...path, "ref"], scope)
  }
  if ("value" in node) {
    return inferValue(node.value)
  }
  const name = node.fn
  if (!isFunctionName(name)) {
    fail(walk, [...path, "fn"], `Unknown function ${name}`)
    return undefined
  }
  const argScope = argumentScope(walk, name, [...path, "fn"], scope)
  const report: Report = (at, message) => {
    fail(walk, at, message)
  }
  return checkFunctionCall({
    name,
    nodes: node.args,
    args: node.args.map((arg, index) =>
      infer(walk, arg, [...path, "args", index], argScope)
    ),
    path,
    report,
  })
}

/**
 * Creates a checker that shares its work across expressions: each referenced
 * derived field and aggregate is checked once, however many expressions
 * reference it. Use it to check every item of a view; the options must not
 * change while it's in use.
 *
 * @experimental
 */
export function createExpressionChecker(
  options: ExpressionCheckerOptions
): ExpressionChecker {
  return createObservedChecker(options, undefined)
}

/**
 * Creates a checker as `createExpressionChecker` does that also passes every
 * node it types to `observe`, so a caller can read the types of subexpressions.
 */
export function createObservedChecker(
  options: ExpressionCheckerOptions,
  observe: ObserveNode | undefined
): ExpressionChecker {
  const context: Context = {
    options,
    observe,
    resolved: { derived: new Map(), aggregate: new Map() },
    stack: [],
  }
  return (expression, kind) => {
    let result = checkTree(context, expression, kind)
    while (result.pending) {
      resolveItems(context, result.pending)
      result = checkTree(context, expression, kind)
    }
    const { type, issues } = result
    if (type && type.type !== "null" && issues.length === 0) {
      return {
        success: true,
        data:
          type.unit === undefined
            ? { type: type.type }
            : { type: type.type, unit: type.unit },
      }
    }
    return failure(issues)
  }
}

/**
 * Type-checks an expression against the function catalog and the dataset's
 * fields, and returns the type of its value. A `ref` names a derived field
 * where a row value is expected and an aggregate where a group value is, and
 * is checked in turn, so a circular reference or a reference to an invalid
 * item is an issue at the `ref`. Issue paths point into the expression. To
 * check many expressions against the same items, use
 * `createExpressionChecker`.
 *
 * @experimental
 */
export function checkExpression(
  expression: Expression,
  { kind, ...options }: CheckExpressionOptions
): Result<ExpressionType> {
  return createExpressionChecker(options)(expression, kind)
}
