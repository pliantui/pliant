import { existsSync } from "node:fs"
import { Node, SyntaxKind, type Project } from "ts-morph"

import { manifestSchema, type Manifest } from "@pliantui/contract"

import { readPropertyKey, unwrapExpression } from "../utils/read-static"

function readJson(node: Node): unknown {
  const value = unwrapExpression(node)
  if (
    Node.isStringLiteral(value) ||
    Node.isNoSubstitutionTemplateLiteral(value) ||
    Node.isNumericLiteral(value)
  ) {
    return value.getLiteralValue()
  }
  if (
    Node.isPrefixUnaryExpression(value) &&
    value.getOperatorToken() === SyntaxKind.MinusToken
  ) {
    const operand = readJson(value.getOperand())
    return typeof operand === "number" ? -operand : undefined
  }
  switch (value.getKind()) {
    case SyntaxKind.TrueKeyword:
      return true
    case SyntaxKind.FalseKeyword:
      return false
    case SyntaxKind.NullKeyword:
      return null
  }
  if (Node.isArrayLiteralExpression(value)) {
    return value.getElements().map(readJson)
  }
  if (Node.isObjectLiteralExpression(value)) {
    const entries = value.getProperties().flatMap((property) => {
      if (!Node.isPropertyAssignment(property)) {
        return []
      }
      const key = readPropertyKey(property.getNameNode())
      const initializer = property.getInitializer()
      return key === undefined || !initializer
        ? []
        : [[key, readJson(initializer)] as const]
    })
    return Object.fromEntries(entries)
  }
  return undefined
}

/**
 * The manifests `pliantui manifest` generated, by component name. A
 * manifest that isn't valid is left out.
 */
export function readManifests(
  project: Project,
  file: string
): Map<string, Manifest> {
  const manifests = new Map<string, Manifest>()
  if (!existsSync(file)) {
    return manifests
  }
  const initializer = project
    .addSourceFileAtPath(file)
    .getVariableDeclaration("manifests")
    ?.getInitializer()
  const value = initializer && readJson(initializer)
  if (typeof value !== "object" || value === null) {
    return manifests
  }
  for (const [name, manifest] of Object.entries(value)) {
    const parsed = manifestSchema.safeParse(manifest)
    if (parsed.success) {
      manifests.set(name, parsed.data)
    }
  }
  return manifests
}
