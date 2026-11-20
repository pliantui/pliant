import { Node, type Symbol } from "ts-morph"

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
 * through renamed imports and re-exports in the app's own modules. It reads
 * the import statements, so it works whether or not the package is
 * installed.
 */
export function isPliantExport(node: Node, module: string, name: string) {
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
