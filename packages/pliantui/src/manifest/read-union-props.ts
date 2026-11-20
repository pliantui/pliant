import {
  Node,
  SyntaxKind,
  type ParameterDeclaration,
  type PropertySignature,
} from "ts-morph"

import { getDefault, isCallTo, type Component } from "./component"
import { getDeclarations } from "./read-static"

function getPropsTypeNode(component: Component) {
  const parameter: ParameterDeclaration | undefined =
    component.fn.getParameters()[0]
  const annotated = parameter?.getTypeNode()
  if (annotated) {
    return annotated
  }
  const call = component.fn.getParentIfKind(SyntaxKind.CallExpression)
  return call && isCallTo(call, ["forwardRef"])
    ? call.getTypeArguments()[1]
    : undefined
}

function getPropertySignatures(
  node: Node | undefined,
  seen = new Set<Node>()
): PropertySignature[] {
  if (!node || seen.has(node)) {
    return []
  }
  seen.add(node)
  if (Node.isTypeLiteral(node)) {
    return node.getProperties()
  }
  if (Node.isIntersectionTypeNode(node)) {
    return node
      .getTypeNodes()
      .flatMap((part) => getPropertySignatures(part, seen))
  }
  if (Node.isParenthesizedTypeNode(node)) {
    return getPropertySignatures(node.getTypeNode(), seen)
  }
  if (Node.isTypeReference(node)) {
    return getDeclarations(node.getTypeName()).flatMap((declaration) => {
      const sourceFile = declaration.getSourceFile()
      if (sourceFile.isDeclarationFile() || sourceFile.isInNodeModules()) {
        return []
      }
      if (Node.isInterfaceDeclaration(declaration)) {
        return declaration.getProperties()
      }
      if (Node.isTypeAliasDeclaration(declaration)) {
        return getPropertySignatures(declaration.getTypeNode(), seen)
      }
      return []
    })
  }
  return []
}

function readStringUnion(node: Node | undefined) {
  if (!Node.isUnionTypeNode(node)) {
    return undefined
  }
  const values: string[] = []
  for (const member of node.getTypeNodes()) {
    if (member.getKind() === SyntaxKind.UndefinedKeyword) {
      continue
    }
    if (!Node.isLiteralTypeNode(member)) {
      return undefined
    }
    const literal = member.getLiteral()
    if (literal.getKind() === SyntaxKind.NullKeyword) {
      continue
    }
    if (!Node.isStringLiteral(literal)) {
      return undefined
    }
    values.push(literal.getLiteralValue())
  }
  return values.length >= 2 ? values : undefined
}

export function readUnionProps(component: Component) {
  for (const signature of getPropertySignatures(getPropsTypeNode(component))) {
    const name = signature.getName()
    const values = readStringUnion(signature.getTypeNode())
    if (!values || component.props.has(name)) {
      continue
    }
    const binding = [...component.bindings.values()].find(
      (found) => found.prop === name
    )
    component.props.set(name, {
      source: "union",
      values,
      boolean: false,
      default: binding ? getDefault(binding, values, undefined) : undefined,
    })
  }
}
