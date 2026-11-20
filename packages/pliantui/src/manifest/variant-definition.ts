import { Node, SyntaxKind, type CallExpression } from "ts-morph"

import { createDiagnostic, type Diagnostic } from "./diagnostic"
import {
  describeExpression,
  getDeclarations,
  readLiteral,
  readObject,
  resolveExpression,
  unwrapExpression,
} from "./read-static"

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

/**
 * Finds which library a called function comes from, following re-exports
 * and aliases through the app's own modules, such as a `tv` made with
 * `createTV` in `lib/utils`.
 */
function getFactory(call: CallExpression): Factory | undefined {
  const callee = call.getExpression()
  if (Node.isPropertyAccessExpression(callee)) {
    const module = getNamespaceModule(callee.getExpression())
    const factory = module === undefined ? undefined : factories[module]
    return factory?.name === callee.getName() ? factory : undefined
  }
  if (!Node.isIdentifier(callee)) {
    return undefined
  }
  let symbol = callee.getSymbol()
  for (let depth = 0; symbol && depth < 10; depth++) {
    for (const declaration of symbol.getDeclarations()) {
      const imported = getImportedName(declaration)
      const factory = imported && factories[imported.module]
      if (imported && factory?.name === imported.name) {
        return factory
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
    symbol = symbol.isAlias() ? symbol.getImmediatelyAliasedSymbol() : undefined
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
  const name = getCalleeName(value.getExpression())
  return name === "cva" || name === "tv" ? value : undefined
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
      `The variants of ${definition.name} can't be read statically: ${describeExpression(configArgument)} isn't an object literal.`
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
        // null or undefined means the variant has no default.
        if (
          resolved.getKind() === SyntaxKind.NullKeyword ||
          resolved.getText() === "undefined"
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
      `The variants of ${definition.name} can't be read statically: ${describeExpression(node)} isn't an object literal.`
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
        `The ${name} variant of ${definition.name} can't be read statically: ${describeExpression(valueNode)} isn't an object literal.`
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
