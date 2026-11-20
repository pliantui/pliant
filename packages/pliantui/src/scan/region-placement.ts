import { Node, SyntaxKind } from "ts-morph"

import { getDeclarations, unwrapExpression } from "../utils/read-static"
import { isFunction, type ComponentFunction } from "./scope"

/**
 * Where a region sits in a value: the member names from the value to the
 * region, `[]` when the value is the region.
 */
export type MemberPath = readonly string[]

function outerExpression(node: Node) {
  let current = node
  let parent = current.getParent()
  while (
    parent &&
    (Node.isParenthesizedExpression(parent) ||
      Node.isAsExpression(parent) ||
      Node.isSatisfiesExpression(parent) ||
      Node.isNonNullExpression(parent))
  ) {
    current = parent
    parent = current.getParent()
  }
  return { node: current, parent }
}

function returnedExpressions(fn: ComponentFunction) {
  const body = fn.getBody()
  if (body && !Node.isBlock(body)) {
    return [body]
  }
  return fn
    .getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(isFunction) === fn)
    .flatMap((statement) => {
      const expression = statement.getExpression()
      return expression ? [unwrapExpression(expression)] : []
    })
}

/**
 * Where the value of `call` sits in what `fn` returns: returned as it is,
 * as a property of a returned object literal, or through a `const` that is
 * returned either way. `undefined` when the scan can't tell.
 */
export function returnPath(
  fn: ComponentFunction,
  call: Node
): MemberPath | undefined {
  const { node, parent } = outerExpression(call)
  if (Node.isReturnStatement(parent) || parent === fn) {
    return []
  }
  if (Node.isPropertyAssignment(parent) && parent.getInitializer() === node) {
    const object = outerExpression(parent.getParentOrThrow())
    return Node.isReturnStatement(object.parent) || object.parent === fn
      ? [parent.getName()]
      : undefined
  }
  if (
    !Node.isVariableDeclaration(parent) ||
    !Node.isIdentifier(parent.getNameNode())
  ) {
    return undefined
  }
  const holds = (value: Node | undefined) =>
    value !== undefined &&
    (Node.isIdentifier(value) || Node.isShorthandPropertyAssignment(value)) &&
    getDeclarations(value)[0] === parent
  for (const returned of returnedExpressions(fn)) {
    if (holds(returned)) {
      return []
    }
    if (!Node.isObjectLiteralExpression(returned)) {
      continue
    }
    for (const property of returned.getProperties()) {
      if (Node.isShorthandPropertyAssignment(property) && holds(property)) {
        return [property.getName()]
      }
      if (Node.isPropertyAssignment(property)) {
        const initializer = property.getInitializer()
        if (holds(initializer && unwrapExpression(initializer))) {
          return [property.getName()]
        }
      }
    }
  }
  return undefined
}

/**
 * The variable a reference reads, and the member path it reads from it:
 * `both.a.entries` reads `["a", "entries"]` of `both`, and `entries` from
 * `const { entries } = useRegion()` reads `["entries"]`.
 */
export function usageOf(
  reference: Node
): { readonly variable: Node; readonly path: MemberPath } | undefined {
  const declaration = getDeclarations(reference)[0]
  const path: string[] = []
  let current = declaration
  while (Node.isBindingElement(current)) {
    if (current.getDotDotDotToken() === undefined) {
      path.unshift(
        current.getPropertyNameNode()?.getText() ?? current.getName()
      )
    }
    const pattern = current.getParent()
    if (!Node.isObjectBindingPattern(pattern)) {
      return undefined
    }
    current = pattern.getParent()
  }
  if (!Node.isVariableDeclaration(current)) {
    return undefined
  }
  let access: Node = reference
  let parent = access.getParent()
  while (
    Node.isPropertyAccessExpression(parent) &&
    parent.getExpression() === access
  ) {
    path.push(parent.getName())
    access = parent
    parent = access.getParent()
  }
  return { variable: current, path }
}

/** Whether reading `read` reads the region at `region`, or holds it. */
export function reaches(read: MemberPath, region: MemberPath) {
  const length = Math.min(read.length, region.length)
  return read.slice(0, length).every((name, index) => name === region[index])
}
