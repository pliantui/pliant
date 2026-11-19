import * as z from "zod"

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
import type { Result } from "./result"

/**
 * A dataset field as the expression checker reads it.
 *
 * @experimental
 */
export interface ExpressionField {
  readonly type:
    | "string"
    | "text"
    | "number"
    | "integer"
    | "currency"
    | "percent"
    | "boolean"
    | "date"
    | "datetime"
    | "enum"
    | "id"
    | "url"
    | "email"
  /** The currency code of a `currency` field, which is its unit. */
  readonly currency?: string | undefined
  /** A unit the developer declares on a `number` or `integer` field. */
  readonly unit?: string | undefined
}

/**
 * The type of an expression's value.
 *
 * @experimental
 */
export interface ExpressionType {
  /** `null` when the value is always null, as for `{ value: null }`. */
  readonly type: ValueType | "null"
  /** The unit of a number: a currency code, `percent`, or a declared unit. */
  readonly unit?: string
}

/**
 * What `checkExpression` checks an expression against.
 *
 * @experimental
 */
export interface CheckExpressionOptions {
  /**
   * `row` for a derived field, which can't use aggregate functions.
   * `aggregate` for an aggregate, which reads fields and derived fields only
   * inside aggregate functions and can't use window functions.
   */
  readonly kind: "row" | "aggregate"
  /** The dataset's fields, by id. */
  readonly fields: Readonly<Record<string, ExpressionField>>
  /** The derived fields a `ref` can name, by id. */
  readonly derived?: Readonly<Record<string, Expression>> | undefined
  /** The aggregates a `ref` can name, by id. */
  readonly aggregates?: Readonly<Record<string, Expression>> | undefined
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

interface Context {
  readonly options: CheckExpressionOptions
  readonly resolved: Record<ItemKind, Map<string, Resolved | "checking">>
  readonly stack: { kind: ItemKind; id: string }[]
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

function unitOf({ type, currency, unit }: ExpressionField) {
  switch (type) {
    case "currency":
      return currency
    case "percent":
      return "percent"
    case "number":
    case "integer":
      return unit
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
  if (id.includes(".")) {
    fail(walk, path, `Dotted paths like ${id} are reserved for relations`)
    return undefined
  }
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
  kind: CheckExpressionOptions["kind"]
) {
  const walk: Walk = { context, issues: [], window: false }
  const type = infer(walk, expression, [], {
    level: kind === "row" ? "row" : "group",
  })
  return { type, issues: walk.issues, window: walk.window }
}

function resolve(
  context: Context,
  kind: ItemKind,
  id: string,
  expression: Expression
): Resolved {
  const resolved = context.resolved[kind]
  const known = resolved.get(id)
  if (known === "checking") {
    const start = context.stack.findIndex(
      (entry) => entry.kind === kind && entry.id === id
    )
    const cycle = [...context.stack.slice(start).map((entry) => entry.id), id]
    return { cause: `Circular reference: ${cycle.join(" → ")}`, cycle: true }
  }
  if (known) {
    return known
  }
  resolved.set(id, "checking")
  context.stack.push({ kind, id })
  const { type, issues, window } = checkTree(
    context,
    expression,
    kind === "derived" ? "row" : "aggregate"
  )
  context.stack.pop()
  const result: Resolved =
    type && issues.length === 0
      ? { type: { type: type.type, unit: type.unit }, window }
      : { cause: issues[0]?.cause ?? `${id} is invalid`, cycle: false }
  resolved.set(id, result)
  return result
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
  if (id.includes(".")) {
    fail(walk, path, `Dotted paths like ${id} are reserved for relations`)
    return undefined
  }
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
  const resolved = resolve(context, kind, id, expression)
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
  return resolved.type
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
 * Type-checks an expression against the function catalog and the dataset's
 * fields, and returns the type of its value. A `ref` names a derived field
 * where a row value is expected and an aggregate where a group value is, and
 * is checked in turn, so a reference cycle or a reference to an invalid item
 * is an issue at the `ref`. Issue paths point into the expression.
 *
 * @experimental
 */
export function checkExpression(
  expression: Expression,
  options: CheckExpressionOptions
): Result<ExpressionType> {
  const context: Context = {
    options,
    resolved: { derived: new Map(), aggregate: new Map() },
    stack: [],
  }
  const { type, issues } = checkTree(context, expression, options.kind)
  if (type && issues.length === 0) {
    return {
      success: true,
      data:
        type.unit === undefined
          ? { type: type.type }
          : { type: type.type, unit: type.unit },
    }
  }
  return {
    success: false,
    error: new z.ZodError(
      issues.map(({ path, message }) => ({
        code: "custom",
        path: [...path],
        message,
      }))
    ),
  }
}
