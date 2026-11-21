import {
  Node,
  SyntaxKind,
  type CallExpression,
  type Symbol as TsMorphSymbol,
} from "ts-morph"

import { createDiagnostic, type Diagnostic } from "../utils/diagnostic"
import {
  describeExpression,
  getDeclarations,
  getMutatedName,
  readLiteral,
  readObject,
  resolveExpression,
  unwrapExpression,
} from "../utils/read-static"

type VariantLibrary = "cva" | "tv"

interface Variant {
  values: string[]
  boolean: boolean
}

export interface VariantDefinition {
  library: VariantLibrary
  name: string
  readable: boolean
  variants: Map<string, Variant>
  unreadable: Set<string>
  defaults: Map<string, string>
}

interface Factory {
  name: string
  library: VariantLibrary
  config: number
}

// Where each library takes its config: cva(base, config), cva({ base, ... })
// in the `cva` package, and tv(config).
const factories: Record<string, Factory> = {
  "class-variance-authority": { name: "cva", library: "cva", config: 1 },
  cva: { name: "cva", library: "cva", config: 0 },
  "tailwind-variants": { name: "tv", library: "tv", config: 0 },
  "tailwind-variants/lite": { name: "tv", library: "tv", config: 0 },
}

const reservedVariantNames = new Set([
  "defaultVariants",
  "compoundVariants",
  "compoundSlots",
  "slots",
  "variants",
])

const classKeys = new Set(["class", "className"])

// tailwind-variants' createTV() returns a tv with a custom config.
const factoryMakers: Record<string, { name: string; factory: Factory }> = {
  "tailwind-variants": {
    name: "createTV",
    factory: { name: "tv", library: "tv", config: 0 },
  },
}

/** The module and original name an import or re-export refers to. */
function getImportedName(declaration: Node) {
  if (Node.isImportSpecifier(declaration)) {
    const { propertyName, name } = declaration.compilerNode
    return {
      module: declaration.getImportDeclaration().getModuleSpecifierValue(),
      name: (propertyName ?? name).text,
    }
  }
  if (Node.isExportSpecifier(declaration)) {
    const module = declaration.getExportDeclaration().getModuleSpecifierValue()
    const { propertyName, name } = declaration.compilerNode
    return module === undefined
      ? undefined
      : { module, name: (propertyName ?? name).text }
  }
  return undefined
}

function getNamespaceModule(node: Node) {
  for (const declaration of getDeclarations(node, { followAliases: false })) {
    if (Node.isNamespaceImport(declaration)) {
      return declaration
        .getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ?.getModuleSpecifierValue()
    }
  }
  return undefined
}

function getCalleeName(callee: Node) {
  return Node.isPropertyAccessExpression(callee)
    ? callee.getName()
    : callee.getText()
}

function unreadableMessage(
  node: Node,
  unreadable: string,
  consequence: string
) {
  const mutated = getMutatedName(node)
  return mutated
    ? `${mutated} is changed after it's created, so it can't be read statically, and ${consequence}.`
    : `${unreadable}: ${describeExpression(node)} isn't an object literal.`
}

/** The callee's symbol and every symbol its import or re-export chain leads to. */
function getCalleeSymbols(callee: Node): TsMorphSymbol[] {
  const nameNode = Node.isPropertyAccessExpression(callee)
    ? callee.getNameNode()
    : callee
  const symbols: TsMorphSymbol[] = []
  let symbol = nameNode.getSymbol()
  for (let depth = 0; symbol && depth < 10; depth++) {
    symbols.push(symbol)
    symbol = symbol.isAlias() ? symbol.getImmediatelyAliasedSymbol() : undefined
  }
  const last = symbols.at(-1)
  const target = last?.isAlias() ? last.getAliasedSymbol() : undefined
  return target ? [...symbols, target] : symbols
}

// The package a declaration file belongs to, when it's installed.
function getPackageName(declaration: Node) {
  const matches = [
    ...declaration
      .getSourceFile()
      .getFilePath()
      .matchAll(/\/node_modules\/((?:@[^/]+\/)?[^/]+)\//g),
  ]
  return matches.at(-1)?.[1]
}

/**
 * Finds which library a called function comes from. It follows aliases,
 * re-exports (including `export *`) and namespace imports through the app's
 * own modules, and recognises a `tv` made with `createTV`.
 */
function getFactory(call: CallExpression): Factory | undefined {
  const callee = call.getExpression()
  if (Node.isPropertyAccessExpression(callee)) {
    const module = getNamespaceModule(callee.getExpression())
    const factory = module === undefined ? undefined : factories[module]
    if (factory?.name === callee.getName()) {
      return factory
    }
  } else if (!Node.isIdentifier(callee)) {
    return undefined
  }
  for (const symbol of getCalleeSymbols(callee)) {
    for (const declaration of symbol.getDeclarations()) {
      const imported = getImportedName(declaration)
      const factory = imported && factories[imported.module]
      if (imported && factory?.name === imported.name) {
        return factory
      }
      const packageName = getPackageName(declaration)
      const installed = packageName && factories[packageName]
      if (installed && installed.name === symbol.getName()) {
        return installed
      }
      if (Node.isVariableDeclaration(declaration)) {
        const initializer = declaration.getInitializer()
        const made = initializer && unwrapExpression(initializer)
        const maker = Node.isCallExpression(made)
          ? made.getExpression()
          : undefined
        if (Node.isIdentifier(maker)) {
          for (const makerDeclaration of getDeclarations(maker, {
            followAliases: false,
          })) {
            const source = getImportedName(makerDeclaration)
            const entry = source && factoryMakers[source.module]
            if (source && entry?.name === source.name) {
              return entry.factory
            }
          }
        }
      }
    }
  }
  return undefined
}

/** Returns the cva or tv call a variants function, like `buttonVariants`, is made by. */
export function getVariantCall(callee: Node): CallExpression | undefined {
  const value = resolveExpression(callee)
  if (Node.isCallExpression(value) && getFactory(value)) {
    return value
  }
  return undefined
}

/**
 * Returns a call to a function named cva or tv that can't be traced back to
 * class-variance-authority or tailwind-variants, so it can be reported.
 */
export function getUntracedVariantCall(
  callee: Node
): CallExpression | undefined {
  const value = resolveExpression(callee)
  if (!Node.isCallExpression(value) || getFactory(value)) {
    return undefined
  }
  // Aliases count too, like `import { cva as variants }`.
  const calledName = value.getExpression()
  const names = [
    getCalleeName(calledName),
    ...getCalleeSymbols(calledName).flatMap((symbol) => [
      symbol.getName(),
      ...symbol
        .getDeclarations()
        .map((declaration) => getImportedName(declaration)?.name),
    ]),
  ]
  return names.some((name) => name === "cva" || name === "tv")
    ? value
    : undefined
}

export function readVariantDefinition(
  call: CallExpression,
  diagnostics: Diagnostic[],
  cache = new Map<CallExpression, VariantDefinition>()
): VariantDefinition {
  const cached = cache.get(call)
  if (cached) {
    return cached
  }
  const factory = getFactory(call)
  const parent = call.getParent()
  const definition: VariantDefinition = {
    library: factory?.library ?? "cva",
    name: Node.isVariableDeclaration(parent)
      ? parent.getName()
      : `${factory?.name ?? "cva"}()`,
    readable: true,
    variants: new Map(),
    unreadable: new Set(),
    defaults: new Map(),
  }
  cache.set(call, definition)

  const report = (node: Node, message: string) =>
    diagnostics.push(createDiagnostic(node, message))

  const configArgument = call.getArguments()[factory?.config ?? 1]
  if (!configArgument) {
    return definition
  }
  const config = readObject(resolveExpression(configArgument))
  if (!config) {
    definition.readable = false
    report(
      configArgument,
      unreadableMessage(
        configArgument,
        `The variants of ${definition.name} can't be read statically`,
        `the variants of ${definition.name} are left out`
      )
    )
    return definition
  }

  const extend = config.entries.get("extend")
  if (definition.library === "tv" && extend) {
    const base = resolveExpression(extend)
    if (Node.isCallExpression(base) && getFactory(base)) {
      const inherited = readVariantDefinition(base, diagnostics, cache)
      definition.readable = inherited.readable
      for (const [name, variant] of inherited.variants) {
        definition.variants.set(name, {
          ...variant,
          values: [...variant.values],
        })
      }
      for (const name of inherited.unreadable) {
        definition.unreadable.add(name)
      }
      for (const [name, value] of inherited.defaults) {
        definition.defaults.set(name, value)
      }
    } else {
      definition.readable = false
      report(
        extend,
        `The variants of ${definition.name} can't be read statically: it extends ${describeExpression(extend)}, which isn't a tv() call.`
      )
    }
  }

  const variantsNode = config.entries.get("variants")
  if (variantsNode) {
    readVariants(variantsNode, definition, report)
  }

  const defaultsNode = config.entries.get("defaultVariants")
  if (defaultsNode) {
    const defaults = readObject(resolveExpression(defaultsNode))
    if (!defaults) {
      report(
        defaultsNode,
        `The defaultVariants of ${definition.name} can't be read statically, so no defaults were taken from it.`
      )
    } else {
      for (const [name, valueNode] of defaults.entries) {
        const resolved = unwrapExpression(resolveExpression(valueNode))
        // null, undefined or void 0 means the variant has no default.
        if (
          resolved.getKind() === SyntaxKind.NullKeyword ||
          resolved.getText() === "undefined" ||
          Node.isVoidExpression(resolved)
        ) {
          continue
        }
        const value = readLiteral(valueNode)
        if (value === undefined) {
          report(
            valueNode,
            `The default ${name} of ${definition.name} can't be read statically.`
          )
          continue
        }
        definition.defaults.set(name, String(value))
      }
    }
  }

  const compoundNode = config.entries.get("compoundVariants")
  if (compoundNode) {
    checkCompoundVariants(compoundNode, definition, report)
  }

  return definition
}

function readVariants(
  node: Node,
  definition: VariantDefinition,
  report: (node: Node, message: string) => void
) {
  const variants = readObject(resolveExpression(node))
  if (!variants) {
    definition.readable = false
    report(
      node,
      unreadableMessage(
        node,
        `The variants of ${definition.name} can't be read statically`,
        `the variants of ${definition.name} are left out`
      )
    )
    return
  }
  if (variants.problems.length > 0) {
    definition.readable = false
  }
  for (const problem of variants.problems) {
    report(
      problem.node,
      `A variant of ${definition.name} can't be read statically: ${problem.reason}.`
    )
  }

  for (const [name, valueNode] of variants.entries) {
    if (reservedVariantNames.has(name)) {
      report(
        valueNode.getParentOrThrow(),
        `${name} is nested inside the variants of ${definition.name}, where cva and tv treat it as a variant, so it has no effect. Move it next to variants.`
      )
      continue
    }
    const values = readObject(resolveExpression(valueNode))
    if (!values) {
      definition.unreadable.add(name)
      report(
        valueNode,
        unreadableMessage(
          valueNode,
          `The ${name} variant of ${definition.name} can't be read statically`,
          `the ${name} variant of ${definition.name} is left out`
        )
      )
      continue
    }
    if (values.problems.length > 0) {
      definition.unreadable.add(name)
      for (const problem of values.problems) {
        report(
          problem.node,
          `The ${name} variant of ${definition.name} can't be read statically: ${problem.reason}.`
        )
      }
      continue
    }
    const keys = [...values.entries.keys()]
    const existing = definition.variants.get(name)
    const merged = [...new Set([...(existing?.values ?? []), ...keys])]
    definition.variants.set(name, {
      values: merged,
      boolean: merged.every((key) => key === "true" || key === "false"),
    })
  }
}

function checkCompoundVariants(
  node: Node,
  definition: VariantDefinition,
  report: (node: Node, message: string) => void
) {
  const list = unwrapExpression(resolveExpression(node))
  if (!Node.isArrayLiteralExpression(list)) {
    report(
      node,
      `The compoundVariants of ${definition.name} can't be read statically.`
    )
    return
  }
  for (const element of list.getElements()) {
    const compound = readObject(resolveExpression(element))
    if (!compound) {
      report(
        element,
        `A compound variant of ${definition.name} can't be read statically.`
      )
      continue
    }
    for (const [name, valueNode] of compound.entries) {
      if (classKeys.has(name)) {
        continue
      }
      const variant = definition.variants.get(name)
      if (!variant) {
        report(
          valueNode.getParentOrThrow(),
          `A compound variant of ${definition.name} refers to ${name}, which isn't a declared variant.`
        )
        continue
      }
      const resolved = unwrapExpression(resolveExpression(valueNode))
      const valueNodes = Node.isArrayLiteralExpression(resolved)
        ? resolved.getElements()
        : [valueNode]
      for (const item of valueNodes) {
        const value = readLiteral(item)
        if (value !== undefined && !variant.values.includes(String(value))) {
          report(
            item,
            `A compound variant of ${definition.name} refers to ${name}: ${JSON.stringify(value)}, which isn't a declared value.`
          )
        }
      }
    }
  }
}
