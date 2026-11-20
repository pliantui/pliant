import { Node, SyntaxKind, VariableDeclarationKind } from "ts-morph"

export interface StaticObject {
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
      if (initializer && Node.isIdentifier(declaration.getNameNode())) {
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
