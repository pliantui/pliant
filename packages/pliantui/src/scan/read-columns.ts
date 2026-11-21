import { Node } from "ts-morph"

import {
  describeExpression,
  readObject,
  resolveExpression,
  unwrapExpression,
} from "../utils/read-static"
import { propOf, readString, type Scope } from "./scope"

export interface ReadColumns {
  readonly ids: { readonly id: string; readonly at: Node }[]
  readonly problems: { readonly node: Node; readonly reason: string }[]
}

function resolve(expression: Node, scope: Scope): [Node, Scope] {
  const prop = propOf(expression, scope)
  const value = prop === undefined ? undefined : scope.props.get(prop)
  const [node] = value?.nodes ?? []
  return value && node
    ? resolve(node, value.scope)
    : [resolveExpression(expression), scope]
}

function returnedExpression(fn: Node) {
  if (!Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn)) {
    return undefined
  }
  const body = fn.getBody()
  if (!Node.isBlock(body)) {
    return body
  }
  const statements = body.getStatements()
  const last = statements.at(-1)
  return statements.length === 1 && Node.isReturnStatement(last)
    ? last.getExpression()
    : undefined
}

/**
 * The leaf column ids of TanStack column defs, in order, with ids as
 * TanStack derives them: `id`, else `accessorKey` with dots as underscores,
 * else a string `header`. Reads arrays of defs, `columnHelper.columns`,
 * `accessor`, `display` and `group`, and a `useMemo` that returns them.
 */
export function readColumns(expression: Node, scope: Scope): ReadColumns {
  const result: ReadColumns = { ids: [], problems: [] }
  readList(expression, scope, result)
  return result
}

function readList(expression: Node, scope: Scope, result: ReadColumns) {
  const [value, valueScope] = resolve(expression, scope)
  if (Node.isArrayLiteralExpression(value)) {
    for (const element of value.getElements()) {
      if (Node.isSpreadElement(element)) {
        readList(element.getExpression(), valueScope, result)
      } else {
        readDef(element, valueScope, result)
      }
    }
    return
  }
  if (Node.isCallExpression(value)) {
    const callee = unwrapExpression(value.getExpression())
    const [first] = value.getArguments()
    if (
      first &&
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === "columns"
    ) {
      readList(first, valueScope, result)
      return
    }
    const returned = first && returnedExpression(unwrapExpression(first))
    if (
      Node.isIdentifier(callee) &&
      callee.getText() === "useMemo" &&
      returned
    ) {
      readList(returned, valueScope, result)
      return
    }
  }
  result.problems.push({
    node: expression,
    reason: `the columns ${describeExpression(expression)}`,
  })
}

function readId(
  node: Node,
  scope: Scope,
  result: ReadColumns,
  transform: (id: string) => string = (id) => id
) {
  const read = readString(node, scope)
  if ("problem" in read) {
    result.problems.push({ node, reason: `the column id ${read.problem}` })
    return
  }
  result.ids.push({ id: transform(read.value), at: node })
}

const accessorKeyToId = (key: string) => key.replaceAll(".", "_")

function readOptions(
  options: Node,
  scope: Scope,
  result: ReadColumns,
  accessorKey?: Node
) {
  const [value, valueScope] = resolve(options, scope)
  const object = readObject(value)
  if (!object) {
    result.problems.push({
      node: options,
      reason: `the column ${describeExpression(options)}`,
    })
    return
  }
  for (const { node, reason } of object.problems) {
    result.problems.push({ node, reason: `the column option ${reason}` })
  }
  const { entries } = object
  const children = entries.get("columns")
  if (children) {
    readList(children, valueScope, result)
    return
  }
  const id = entries.get("id")
  const key = accessorKey ?? entries.get("accessorKey")
  const header = entries.get("header")
  if (id) {
    readId(id, valueScope, result)
  } else if (key) {
    readId(key, valueScope, result, accessorKeyToId)
  } else if (header) {
    // Only a string header gives a column its id, as in TanStack.
    const read = readString(header, valueScope)
    if ("value" in read) {
      result.ids.push({ id: read.value, at: header })
    }
  }
}

function readDef(def: Node, scope: Scope, result: ReadColumns) {
  const [value, valueScope] = resolve(def, scope)
  if (Node.isObjectLiteralExpression(value)) {
    readOptions(value, valueScope, result)
    return
  }
  if (Node.isCallExpression(value)) {
    const callee = unwrapExpression(value.getExpression())
    const [first, second] = value.getArguments()
    const method = Node.isPropertyAccessExpression(callee)
      ? callee.getName()
      : undefined
    if (method === "accessor" && first) {
      const accessor = unwrapExpression(first)
      const key =
        Node.isArrowFunction(accessor) || Node.isFunctionExpression(accessor)
          ? undefined
          : first
      if (second) {
        readOptions(second, valueScope, result, key)
      } else if (key) {
        readId(key, valueScope, result, accessorKeyToId)
      }
      return
    }
    if ((method === "display" || method === "group") && first) {
      readOptions(first, valueScope, result)
      return
    }
  }
  result.problems.push({
    node: def,
    reason: `the column ${describeExpression(def)}`,
  })
}
