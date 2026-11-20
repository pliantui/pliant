import { Node, SyntaxKind, VariableDeclarationKind } from "ts-morph"

interface StaticObject {
  entries: Map<string, Node>
  problems: { node: Node; reason: string }[]
}

export function unwrapExpression(node: Node): Node {
  let current = node
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isSatisfiesExpression(current) ||
    Node.isNonNullExpression(current) ||
    Node.isTypeAssertion(current)
  ) {
    current = current.getExpression()
  }
  return current
}

export function getDeclarations(node: Node, { followAliases = true } = {}) {
  let symbol = Node.isShorthandPropertyAssignment(node)
    ? node.getValueSymbol()
    : node.getSymbol()
  if (followAliases && symbol?.isAlias()) {
    symbol = symbol.getAliasedSymbol() ?? symbol
  }
  return symbol?.getDeclarations() ?? []
}

/**
 * Follows `const` references, re-exports and property access to the
 * expression that holds the value. Returns the last node it reached when the
 * value can't be followed further.
 */
export function resolveExpression(node: Node, seen = new Set<Node>()): Node {
  const current = unwrapExpression(node)
  if (seen.has(current)) {
    return current
  }
  seen.add(current)

  if (
    Node.isIdentifier(current) ||
    Node.isShorthandPropertyAssignment(current)
  ) {
    const declaration = getDeclarations(current)[0]
    if (
      Node.isVariableDeclaration(declaration) &&
      declaration.getVariableStatement()?.getDeclarationKind() ===
        VariableDeclarationKind.Const
    ) {
      const initializer = declaration.getInitializer()
      if (
        initializer &&
        Node.isIdentifier(declaration.getNameNode()) &&
        !isMutated(declaration)
      ) {
        return resolveExpression(initializer, seen)
      }
    }
    return current
  }

  if (Node.isPropertyAccessExpression(current)) {
    const object = readObject(resolveExpression(current.getExpression(), seen))
    const value = object?.entries.get(current.getName())
    return value ? resolveExpression(value, seen) : current
  }

  return current
}

const mutated = new WeakMap<Node, boolean>()

// A const object whose properties are assigned, deleted or merged into later
// no longer holds what its literal says.
function isMutated(declaration: Node) {
  const cached = mutated.get(declaration)
  if (cached !== undefined) {
    return cached
  }
  const isDeclaration = (node: Node) => {
    let base = unwrapExpression(node)
    while (
      Node.isPropertyAccessExpression(base) ||
      Node.isElementAccessExpression(base)
    ) {
      base = unwrapExpression(base.getExpression())
    }
    return (
      Node.isIdentifier(base) &&
      getDeclarations(base, { followAliases: false })[0] === declaration
    )
  }
  const isMember = (node: Node) => {
    const target = unwrapExpression(node)
    return (
      (Node.isPropertyAccessExpression(target) ||
        Node.isElementAccessExpression(target)) &&
      isDeclaration(target)
    )
  }
  const result = declaration
    .getSourceFile()
    .getDescendants()
    .some((node) => {
      if (Node.isBinaryExpression(node)) {
        const kind = node.getOperatorToken().getKind()
        return (
          kind >= SyntaxKind.FirstAssignment &&
          kind <= SyntaxKind.LastAssignment &&
          isMember(node.getLeft())
        )
      }
      if (Node.isDeleteExpression(node)) {
        return isMember(node.getExpression())
      }
      if (Node.isCallExpression(node)) {
        const first = node.getArguments()[0]
        return (
          node.getExpression().getText() === "Object.assign" &&
          first !== undefined &&
          isDeclaration(first)
        )
      }
      return false
    })
  mutated.set(declaration, result)
  return result
}

/**
 * The name of the const a value comes from when that const is changed after
 * it's created, so the value can't be read.
 */
export function getMutatedName(node: Node): string | undefined {
  const value = resolveExpression(node)
  if (!Node.isIdentifier(value) && !Node.isShorthandPropertyAssignment(value)) {
    return undefined
  }
  const declaration = getDeclarations(value)[0]
  return Node.isVariableDeclaration(declaration) && isMutated(declaration)
    ? declaration.getName()
    : undefined
}

export function readPropertyKey(name: Node): string | undefined {
  if (Node.isIdentifier(name) || Node.isPrivateIdentifier(name)) {
    return name.getText()
  }
  if (
    Node.isStringLiteral(name) ||
    Node.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.getLiteralValue()
  }
  if (Node.isNumericLiteral(name)) {
    return String(name.getLiteralValue())
  }
  if (Node.isComputedPropertyName(name)) {
    const expression = unwrapExpression(name.getExpression())
    if (
      Node.isStringLiteral(expression) ||
      Node.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return expression.getLiteralValue()
    }
  }
  return undefined
}

/**
 * Reads an object literal's keys without evaluating anything. Spreads are
 * followed when they resolve to another object literal; anything else is
 * reported as a problem instead of being guessed.
 */
export function readObject(
  node: Node,
  seen = new Set<Node>()
): StaticObject | undefined {
  const object = unwrapExpression(node)
  if (!Node.isObjectLiteralExpression(object) || seen.has(object)) {
    return undefined
  }
  seen.add(object)

  const result: StaticObject = { entries: new Map(), problems: [] }
  for (const property of object.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      const key = readPropertyKey(property.getNameNode())
      const initializer = property.getInitializer()
      if (key === undefined || !initializer) {
        result.problems.push({
          node: property,
          reason: `the computed key ${describeExpression(property.getNameNode())}`,
        })
        continue
      }
      result.entries.set(key, initializer)
    } else if (Node.isShorthandPropertyAssignment(property)) {
      result.entries.set(property.getName(), property)
    } else if (Node.isSpreadAssignment(property)) {
      const spread = readObject(
        resolveExpression(property.getExpression()),
        seen
      )
      if (!spread) {
        result.problems.push({
          node: property,
          reason: `the spread ${describeExpression(property)}`,
        })
        continue
      }
      for (const [key, value] of spread.entries) {
        result.entries.set(key, value)
      }
      result.problems.push(...spread.problems)
    } else {
      result.problems.push({
        node: property,
        reason: describeExpression(property),
      })
    }
  }
  return result
}

export function readLiteral(node: Node): string | number | boolean | undefined {
  const value = resolveExpression(node)
  if (
    Node.isStringLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value)
  ) {
    return value.getLiteralValue()
  }
  if (Node.isNumericLiteral(value)) {
    return value.getLiteralValue()
  }
  if (value.getKind() === SyntaxKind.TrueKeyword) {
    return true
  }
  if (value.getKind() === SyntaxKind.FalseKeyword) {
    return false
  }
  if (
    Node.isPrefixUnaryExpression(value) &&
    value.getOperatorToken() === SyntaxKind.MinusToken
  ) {
    const operand = value.getOperand()
    if (Node.isNumericLiteral(operand)) {
      return -operand.getLiteralValue()
    }
  }
  return undefined
}

export function describeExpression(node: Node) {
  const text = node.getText().replace(/\s+/g, " ")
  return text.length > 40 ? `${text.slice(0, 37)}...` : text
}
