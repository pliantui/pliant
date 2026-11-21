import { existsSync, realpathSync } from "node:fs"
import path from "node:path"
import { Node, type ImportDeclaration, type SourceFile } from "ts-morph"

import { getDeclarations, unwrapExpression } from "../utils/read-static"

function realPath(file: string) {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

function isInside(file: string, directory: string) {
  const relative = path.relative(realPath(directory), realPath(file))
  return !relative.startsWith("..") && !path.isAbsolute(relative)
}

// Whether a specifier that doesn't resolve could still name the app's own
// code: a relative or absolute path, a subpath import, or a path the
// tsconfig maps, through `paths` or `baseUrl`.
function mayBeAppPath(specifier: string, sourceFile: SourceFile) {
  if (/^(?:\.|\/|#)/.test(specifier)) {
    return true
  }
  const options = sourceFile.getProject().getCompilerOptions()
  for (const pattern of Object.keys(options.paths ?? {})) {
    const star = pattern.indexOf("*")
    if (
      star === -1
        ? specifier === pattern
        : specifier.startsWith(pattern.slice(0, star)) &&
          specifier.endsWith(pattern.slice(star + 1))
    ) {
      return true
    }
  }
  // TypeScript 6 deprecates baseUrl, but projects on TypeScript 5 still
  // resolve bare paths against it.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const baseUrl = options.baseUrl
  const [first] = specifier.split("/")
  return (
    baseUrl !== undefined &&
    first !== undefined &&
    existsSync(path.join(baseUrl, first))
  )
}

/**
 * Whether an import comes from a package, decided by its specifier: it
 * resolves into `node_modules` or outside the project, or, when it doesn't
 * resolve, it can't name a path of the project. Modules typed only by the
 * app's own declaration files, like `declare module "*.mdx"`, are the app's.
 */
function isPackageImport(declaration: ImportDeclaration, root: string) {
  const target = declaration.getModuleSpecifierSourceFile()
  if (target) {
    return target.isInNodeModules() || !isInside(target.getFilePath(), root)
  }
  return !mayBeAppPath(
    declaration.getModuleSpecifierValue(),
    declaration.getSourceFile()
  )
}

function importOf(identifier: Node) {
  return identifier
    .getSymbol()
    ?.getDeclarations()[0]
    ?.getFirstAncestor((ancestor): ancestor is ImportDeclaration =>
      Node.isImportDeclaration(ancestor)
    )
}

// Whether a value comes from a package: imported from one, or made by
// calling one, like `createContext()`.
function isFromPackage(value: Node, root: string, seen: Set<Node>): boolean {
  let base = unwrapExpression(value)
  while (Node.isPropertyAccessExpression(base) || Node.isCallExpression(base)) {
    base = unwrapExpression(base.getExpression())
  }
  if (!Node.isIdentifier(base) || seen.has(base)) {
    return false
  }
  seen.add(base)
  const imported = importOf(base)
  if (imported) {
    return isPackageImport(imported, root)
  }
  const declaration = base.getSymbol()?.getDeclarations()[0]
  if (!declaration) {
    return false
  }
  const file = declaration.getSourceFile()
  if (file.isInNodeModules() || !isInside(file.getFilePath(), root)) {
    return true
  }
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  return (
    initializer !== undefined &&
    Node.isCallExpression(unwrapExpression(initializer)) &&
    isFromPackage(initializer, root, seen)
  )
}

/**
 * Whether what a JSX tag can render is known without following it as one
 * of the app's function components: an HTML element, a string tag, or a
 * component from a package. A tag that holds anything else, such as a
 * class component, a parameter, the result of a call, or a module typed
 * only by the app's own declaration files, is opaque.
 */
function isKnownTag(value: Node, root: string, seen: Set<Node>): boolean {
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
      isKnownTag(node.getWhenTrue(), root, seen) &&
      isKnownTag(node.getWhenFalse(), root, seen)
    )
  }
  if (!Node.isIdentifier(node) && !Node.isPropertyAccessExpression(node)) {
    return false
  }
  if (isContextPart(node, root)) {
    return true
  }
  let base: Node = node
  while (Node.isPropertyAccessExpression(base)) {
    base = unwrapExpression(base.getExpression())
  }
  // An import is a package's by its specifier, whatever types it has.
  const imported = Node.isIdentifier(base) ? importOf(base) : undefined
  if (imported) {
    return isPackageImport(imported, root)
  }
  if (Node.isIdentifier(node)) {
    const declaration = node.getSymbol()?.getDeclarations()[0]
    if (Node.isVariableDeclaration(declaration)) {
      const initializer = declaration.getInitializer()
      return initializer !== undefined && isKnownTag(initializer, root, seen)
    }
    return false
  }
  // A member a package declares on a parameter, like `table.FlexRender`
  // on a table prop. A member of a call's result, like
  // `useContext(Context).Banner`, may be the app's own data.
  const declaration = getDeclarations(node)[0]
  const file = declaration?.getSourceFile()
  const baseDeclaration = Node.isIdentifier(base)
    ? base.getSymbol()?.getDeclarations()[0]
    : undefined
  return (
    file !== undefined &&
    (file.isInNodeModules() || !isInside(file.getFilePath(), root)) &&
    baseDeclaration !== undefined &&
    (Node.isParameterDeclaration(baseDeclaration) ||
      baseDeclaration.getFirstAncestor((ancestor) =>
        Node.isParameterDeclaration(ancestor)
      ) !== undefined)
  )
}

// `Context.Provider` or `Context.Consumer` of a context made by a
// package's `createContext()`.
function isContextPart(node: Node, root: string) {
  if (
    !Node.isPropertyAccessExpression(node) ||
    !["Provider", "Consumer"].includes(node.getName())
  ) {
    return false
  }
  const context = getDeclarations(node.getExpression())[0]
  const initializer = Node.isVariableDeclaration(context)
    ? context.getInitializer()
    : undefined
  const call = initializer && unwrapExpression(initializer)
  if (!Node.isCallExpression(call)) {
    return false
  }
  const callee = unwrapExpression(call.getExpression())
  const name = Node.isPropertyAccessExpression(callee)
    ? callee.getName()
    : callee.getText()
  return name === "createContext" && isFromPackage(callee, root, new Set())
}

/**
 * Whether an identifier is imported from a package, by the import's
 * specifier; `undefined` when it isn't imported.
 */
export function isImportFromPackage(identifier: Node, root: string) {
  const imported = importOf(identifier)
  return imported && isPackageImport(imported, root)
}

/**
 * Whether a JSX tag renders something the scan can't follow: not an HTML
 * element, not a component from a package, and not one of the app's
 * function components, which the caller has already tried. `root` is the
 * project's folder.
 */
export function isOpaqueTag(tag: Node, root: string) {
  if (Node.isIdentifier(tag) && /^[a-z]/.test(tag.getText())) {
    return false
  }
  return !isKnownTag(tag, root, new Set())
}
