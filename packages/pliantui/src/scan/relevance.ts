import { realpathSync } from "node:fs"
import path from "node:path"
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type VariableDeclaration,
} from "ts-morph"

import { getDeclarations, unwrapExpression } from "../utils/read-static"
import { isImportFromPackage, isOpaqueTag } from "./opaque-tag"
import { componentOf, functionIn, type ComponentFunction } from "./scope"

interface RelevanceOptions {
  /** The project's folder. */
  readonly root: string
  readonly declaresNodes: (fn: ComponentFunction) => boolean
  /** Whether a call is a region or table hook, or the app's hook for one. */
  readonly isRegionHook: (call: CallExpression) => boolean
  /** Whether a call is one of Pliant's own hooks, which never fill what they're passed. */
  readonly isPliantHook: (call: CallExpression) => boolean
  /** Whether a node is a whole reference worth resolving. */
  readonly isReference: (node: Node) => boolean
}

// Methods that put values in an array, a map, a set or an object.
const mutators = new Set([
  "push",
  "unshift",
  "splice",
  "fill",
  "set",
  "add",
  "assign",
])

// Values every script has, with no declaration to resolve.
const builtIns = new Set(["undefined", "NaN", "Infinity", "globalThis"])

function realPath(file: string) {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

function isParameter(node: Node | undefined) {
  return (
    node !== undefined &&
    (Node.isParameterDeclaration(node) ||
      node.getFirstAncestor((ancestor) =>
        Node.isParameterDeclaration(ancestor)
      ) !== undefined)
  )
}

/**
 * Whether code the scan didn't walk may render a region or table, or
 * something it can't follow. It follows every reference, recursively: a
 * function to its body, a value to its initializer, JSX to its tags. A
 * reference it can't resolve counts, so it fails closed. A parameter's
 * value comes from where it's passed, which is checked there, and a region
 * or table handle from a hook is placed by the walk.
 */
export function createRelevance({
  root,
  declaresNodes,
  isRegionHook,
  isPliantHook,
  isReference,
}: RelevanceOptions) {
  const project = realPath(root)
  const isPackageFile = (node: Node) => {
    const file = node.getSourceFile()
    const relative = path.relative(project, realPath(file.getFilePath()))
    return (
      file.isInNodeModules() ||
      relative.startsWith("..") ||
      path.isAbsolute(relative)
    )
  }
  const functions = new Map<ComponentFunction, boolean>()
  const references = new Map<Node, boolean>()

  const relevantCode = (start: Node): boolean => {
    let found = false
    const inspect = (node: Node) => {
      found ||= relevantNode(node)
    }
    inspect(start)
    start.forEachDescendant((node, traversal) => {
      // Types hold no values.
      if (found || Node.isTypeNode(node)) {
        traversal.skip()
        return
      }
      inspect(node)
    })
    return found
  }

  const relevantNode = (node: Node): boolean => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      const tag = node.getTagNameNode()
      // A component passed in, like `<C />` in a wrapper, is checked where
      // it's passed.
      if (Node.isIdentifier(tag) && isParameter(getDeclarations(tag)[0])) {
        return false
      }
      return relevantTag(tag)
    }
    if (Node.isCallExpression(node)) {
      if (isRegionHook(node)) {
        return true
      }
      if (node.getExpression().getKind() === SyntaxKind.ImportKeyword) {
        return true
      }
    }
    return isReference(node) && relevantReference(node)
  }

  // The app's own wrappers a component is made with, like `withPanel` in
  // `const Framed = withPanel(Plain)`, render their own output too.
  const relevantWrappers = (value: Node): boolean => {
    const seen = new Set<Node>()
    let current = unwrapExpression(value)
    while (!seen.has(current)) {
      seen.add(current)
      if (
        Node.isIdentifier(current) ||
        Node.isPropertyAccessExpression(current)
      ) {
        const declaration = getDeclarations(current)[0]
        const initializer = Node.isVariableDeclaration(declaration)
          ? declaration.getInitializer()
          : undefined
        if (!initializer) {
          return false
        }
        current = unwrapExpression(initializer)
        continue
      }
      if (!Node.isCallExpression(current)) {
        return false
      }
      const wrapper = functionIn(current.getExpression())
      if (wrapper && relevantFunction(wrapper)) {
        return true
      }
      const [first] = current.getArguments()
      if (!first) {
        return false
      }
      current = unwrapExpression(first)
    }
    return false
  }

  const relevantTag = (tag: Node): boolean => {
    const fn = componentOf(tag)
    return fn
      ? relevantFunction(fn) || relevantWrappers(tag)
      : isOpaqueTag(tag, root)
  }

  const relevantFunction = (fn: ComponentFunction): boolean => {
    const cached = functions.get(fn)
    if (cached !== undefined) {
      return cached
    }
    functions.set(fn, false)
    const result = declaresNodes(fn) || relevantCode(fn)
    functions.set(fn, result)
    return result
  }

  const resolveReference = (reference: Node): boolean => {
    let base: Node = reference
    while (Node.isPropertyAccessExpression(base)) {
      base = unwrapExpression(base.getExpression())
    }
    if (Node.isIdentifier(base) && builtIns.has(base.getText())) {
      return false
    }
    const baseDeclaration =
      Node.isIdentifier(base) || Node.isShorthandPropertyAssignment(base)
        ? getDeclarations(base)[0]
        : undefined
    if (isParameter(baseDeclaration)) {
      return false
    }
    const holder = Node.isBindingElement(baseDeclaration)
      ? baseDeclaration.getFirstAncestor((ancestor) =>
          Node.isVariableDeclaration(ancestor)
        )
      : baseDeclaration
    const initializer = Node.isVariableDeclaration(holder)
      ? holder.getInitializer()
      : undefined
    const call = initializer && unwrapExpression(initializer)
    if (Node.isCallExpression(call) && isRegionHook(call)) {
      return false
    }
    const fn = functionIn(reference)
    if (fn) {
      return relevantFunction(fn) || relevantWrappers(reference)
    }
    const declaration = getDeclarations(reference)[0]
    if (!declaration) {
      // A member whose type can't be read holds whatever its object holds.
      if (Node.isPropertyAccessExpression(reference)) {
        return relevantValue(base)
      }
      const fromPackage =
        Node.isIdentifier(base) && isImportFromPackage(base, root)
      return fromPackage !== true
    }
    if (isPackageFile(declaration)) {
      // A package's member, like `Map.get`, on the app's own object holds
      // what the object holds.
      return Node.isPropertyAccessExpression(reference) && relevantValue(base)
    }
    if (declaration.getSourceFile().isDeclarationFile()) {
      return true
    }
    if (
      Node.isTypeAliasDeclaration(declaration) ||
      Node.isInterfaceDeclaration(declaration) ||
      Node.isEnumDeclaration(declaration) ||
      Node.isEnumMember(declaration)
    ) {
      return false
    }
    if (Node.isVariableDeclaration(declaration)) {
      const value = declaration.getInitializer()
      return (
        (value !== undefined && relevantCode(value)) ||
        relevantWrites(declaration)
      )
    }
    if (Node.isBindingElement(declaration)) {
      const variable = declaration.getFirstAncestor((ancestor) =>
        Node.isVariableDeclaration(ancestor)
      )
      const value = Node.isVariableDeclaration(variable)
        ? variable.getInitializer()
        : undefined
      return value !== undefined && relevantCode(value)
    }
    if (Node.isPropertyAssignment(declaration)) {
      const value = declaration.getInitializer()
      return value !== undefined && relevantCode(value)
    }
    // A member only a type declares holds whatever its object holds.
    if (
      Node.isPropertyAccessExpression(reference) &&
      (Node.isPropertySignature(declaration) ||
        Node.isPropertyDeclaration(declaration))
    ) {
      return relevantValue(base)
    }
    if (
      Node.isShorthandPropertyAssignment(declaration) ||
      Node.isMethodDeclaration(declaration)
    ) {
      return relevantCode(declaration)
    }
    // A class, an import that doesn't resolve, a property only a type
    // declares: what it holds can't be read.
    return true
  }

  // What an object holds: a named value, or the value an expression makes,
  // like the result of a call.
  const relevantValue = (value: Node): boolean =>
    Node.isIdentifier(value) || Node.isShorthandPropertyAssignment(value)
      ? relevantReference(value)
      : relevantCode(value)

  // What is put in a variable after it's made, like `panels.push(panel)`,
  // `registry.panel = panel` or `Object.assign(registry, …)`.
  const writes = new Map<Node, boolean>()
  const relevantWrites = (declaration: VariableDeclaration): boolean => {
    const name = declaration.getNameNode()
    if (!Node.isIdentifier(name)) {
      return false
    }
    const cached = writes.get(declaration)
    if (cached !== undefined) {
      return cached
    }
    writes.set(declaration, false)
    const result = name.findReferencesAsNodes().some((usage) => {
      if (usage === name || isPackageFile(usage)) {
        return false
      }
      const parent = usage.getParent()
      const member =
        (Node.isPropertyAccessExpression(parent) ||
          Node.isElementAccessExpression(parent)) &&
        parent.getExpression() === usage
          ? parent
          : undefined
      const user = member?.getParent()
      if (
        Node.isPropertyAccessExpression(member) &&
        mutators.has(member.getName()) &&
        Node.isCallExpression(user) &&
        user.getExpression() === member
      ) {
        return user.getArguments().some(relevantCode)
      }
      if (
        member &&
        Node.isBinaryExpression(user) &&
        user.getLeft() === member &&
        user.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      ) {
        return relevantCode(user.getRight())
      }
      // Passed to a call that may fill it, like `Object.assign`.
      return (
        Node.isCallExpression(parent) &&
        parent.getArguments().includes(usage) &&
        !isPliantHook(parent) &&
        relevantCode(parent)
      )
    })
    writes.set(declaration, result)
    return result
  }

  const relevantReference = (reference: Node): boolean => {
    const cached = references.get(reference)
    if (cached !== undefined) {
      return cached
    }
    references.set(reference, false)
    const result = resolveReference(reference)
    references.set(reference, result)
    return result
  }

  return { relevantTag, relevantReference }
}
