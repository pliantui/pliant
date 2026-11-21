import { Node, SyntaxKind, type Symbol } from "ts-morph"

function importedFrom(declaration: Node) {
  if (Node.isImportSpecifier(declaration)) {
    return {
      module: declaration.getImportDeclaration().getModuleSpecifierValue(),
      name: declaration.getName(),
    }
  }
  if (Node.isExportSpecifier(declaration)) {
    return {
      module: declaration.getExportDeclaration().getModuleSpecifierValue(),
      name: declaration.getName(),
    }
  }
  return undefined
}

/**
 * Whether `node` refers to the export `name` of the package entry `module`,
 * through renamed imports, namespace imports and re-exports in the app's
 * own modules. It reads the import statements, so it works whether or not
 * the package is installed.
 */
export function isPliantExport(node: Node, module: string, name: string) {
  // `Pliant.PliantRoot`, through `import * as Pliant from "…"`.
  if (Node.isPropertyAccessExpression(node)) {
    const object = node.getExpression()
    return (
      node.getName() === name &&
      Node.isIdentifier(object) &&
      isNamespaceOf(object, module)
    )
  }
  const seen = new Set<Symbol>()
  let symbol = node.getSymbol()
  while (symbol && !seen.has(symbol)) {
    seen.add(symbol)
    for (const declaration of symbol.getDeclarations()) {
      const imported = importedFrom(declaration)
      if (imported?.module === module && imported.name === name) {
        return true
      }
    }
    symbol = symbol.isAlias() ? symbol.getImmediatelyAliasedSymbol() : undefined
  }
  return false
}

function isNamespaceOf(node: Node, module: string) {
  return (node.getSymbol()?.getDeclarations() ?? []).some(
    (declaration) =>
      // `import * as React` or a default import like `import React`.
      (Node.isNamespaceImport(declaration) ||
        Node.isImportClause(declaration)) &&
      declaration
        .getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ?.getModuleSpecifierValue() === module
  )
}
