import { Node, SyntaxKind, type JsxAttributeLike } from "ts-morph"

import {
  getBinding,
  isCallTo,
  isPropsObject,
  type Component,
} from "./component"
import {
  getDeclarations,
  readLiteral,
  readObject,
  unwrapExpression,
} from "./read-static"

function getProvidedContext(tag: Node) {
  const base = Node.isPropertyAccessExpression(tag)
    ? tag.getName() === "Provider"
      ? tag.getExpression()
      : undefined
    : tag
  const declaration = base && getDeclarations(base)[0]
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  const call = initializer && unwrapExpression(initializer)
  return Node.isCallExpression(call) && isCallTo(call, ["createContext"])
    ? declaration
    : undefined
}

function getAttributeExpression(attribute: JsxAttributeLike) {
  if (!Node.isJsxAttribute(attribute)) {
    return undefined
  }
  const initializer = attribute.getInitializer()
  return Node.isJsxExpression(initializer)
    ? initializer.getExpression()
    : undefined
}

export function readJsx(
  component: Component,
  byDeclaration: Map<Node, Component>
) {
  const elements = [
    ...component.fn.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...component.fn.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ]
  for (const element of elements) {
    const tag = element.getTagNameNode()
    const attributes = element.getAttributes()

    const context = getProvidedContext(tag)
    if (context) {
      const valueAttribute = attributes.find(
        (attribute) =>
          Node.isJsxAttribute(attribute) &&
          attribute.getNameNode().getText() === "value"
      )
      const value = valueAttribute && getAttributeExpression(valueAttribute)
      const object = value && readObject(value)
      for (const [key, node] of object?.entries ?? []) {
        const binding = getBinding(component, node)
        if (binding) {
          component.provides.push({ context, key, binding })
        }
      }
      continue
    }

    const target = getDeclarations(tag)
      .map((declaration) => byDeclaration.get(declaration))
      .find((found) => found !== undefined)
    if (!target || target === component) {
      continue
    }
    for (const [index, attribute] of attributes.entries()) {
      if (Node.isJsxAttribute(attribute)) {
        const expression = getAttributeExpression(attribute)
        const binding = expression && getBinding(component, expression)
        if (binding) {
          component.passes.push({
            target,
            targetProp: attribute.getNameNode().getText(),
            binding,
          })
        }
      } else if (isPropsObject(component, attribute.getExpression())) {
        // Attributes after a spread override it; those before it don't.
        const overridden = attributes
          .slice(index + 1)
          .filter((later) => Node.isJsxAttribute(later))
          .map((later) => later.getNameNode().getText())
        const presets = new Map<string, string>()
        for (const earlier of attributes.slice(0, index)) {
          const initializer = Node.isJsxAttribute(earlier)
            ? earlier.getInitializer()
            : undefined
          const expression = Node.isJsxExpression(initializer)
            ? initializer.getExpression()
            : initializer
          const literal = expression && readLiteral(expression)
          if (Node.isJsxAttribute(earlier) && literal !== undefined) {
            presets.set(earlier.getNameNode().getText(), String(literal))
          }
        }
        component.spreads.push({
          target,
          rest: attribute.getExpression(),
          overridden: new Set(overridden),
          presets,
        })
      }
    }
  }
}
