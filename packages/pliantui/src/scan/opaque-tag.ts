import { Node, type ImportDeclaration } from "ts-morph"

import { getDeclarations, unwrapExpression } from "../utils/read-static"

function isExternalImport(declaration: ImportDeclaration) {
  const target = declaration.getModuleSpecifierSourceFile()
  if (target) {
    return target.isInNodeModules() || target.isDeclarationFile()
  }
  // A package that isn't installed has none of the app's components; a
  // path or alias that doesn't resolve might.
  return !/^(?:\.|\/|~\/|@\/|#)/.test(declaration.getModuleSpecifierValue())
}

function rootOf(node: Node): Node {
  let root = unwrapExpression(node)
  while (Node.isPropertyAccessExpression(root) || Node.isCallExpression(root)) {
    root = unwrapExpression(root.getExpression())
  }
  return root
}

// Whether a member's object comes from a package: imported from one, or
// made by calling one, like `createContext()`.
function isFromPackage(node: Node, seen = new Set<Node>()): boolean {
  const root = rootOf(node)
  if (!Node.isIdentifier(root) || seen.has(root)) {
    return false
  }
  seen.add(root)
  const declaration = root.getSymbol()?.getDeclarations()[0]
  const importDeclaration = declaration?.getFirstAncestor(
    (ancestor): ancestor is ImportDeclaration =>
      Node.isImportDeclaration(ancestor)
  )
  if (importDeclaration) {
    return isExternalImport(importDeclaration)
  }
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  return (
    initializer !== undefined &&
    Node.isCallExpression(unwrapExpression(initializer)) &&
    isFromPackage(initializer, seen)
  )
}

/**
 * Whether what a JSX tag can render is known without following it as one
 * of the app's function components: an HTML element, a string tag, or a
 * component from a package. A tag that holds anything else, such as a
 * class component, a parameter, or the result of a call, is opaque.
 */
function isKnownTag(value: Node, seen: Set<Node>): boolean {
  const node = unwrapExpression(value)
  if (seen.has(node)) {
    return false
  }
  seen.add(node)
  if (
    Node.isStringLiteral(node) ||
    Node.isNoSubstitutionTemplateLiteral(node)
  ) {
    return true
  }
  if (Node.isConditionalExpression(node)) {
    return (
      isKnownTag(node.getWhenTrue(), seen) &&
      isKnownTag(node.getWhenFalse(), seen)
    )
  }
  if (!Node.isIdentifier(node) && !Node.isPropertyAccessExpression(node)) {
    return false
  }
  const declaration = getDeclarations(node)[0]
  if (!declaration) {
    // `Context.Provider` when the package's types aren't installed.
    return Node.isPropertyAccessExpression(node) && isFromPackage(node)
  }
  const sourceFile = declaration.getSourceFile()
  if (sourceFile.isInNodeModules() || sourceFile.isDeclarationFile()) {
    return true
  }
  const importDeclaration = declaration.getFirstAncestor(
    (ancestor): ancestor is ImportDeclaration =>
      Node.isImportDeclaration(ancestor)
  )
  if (importDeclaration) {
    return isExternalImport(importDeclaration)
  }
  if (Node.isVariableDeclaration(declaration)) {
    const initializer = declaration.getInitializer()
    return initializer !== undefined && isKnownTag(initializer, seen)
  }
  return false
}

/**
 * Whether a JSX tag renders something the scan can't follow: not an HTML
 * element, not a component from a package, and not one of the app's
 * function components, which the caller has already tried.
 */
export function isOpaqueTag(tag: Node) {
  if (Node.isIdentifier(tag) && /^[a-z]/.test(tag.getText())) {
    return false
  }
  return !isKnownTag(tag, new Set())
}
