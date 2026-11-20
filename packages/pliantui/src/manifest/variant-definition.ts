import { Node, type CallExpression } from "ts-morph"

import { createDiagnostic, type Diagnostic } from "./diagnostic"
import {
  describeExpression,
  getDeclarations,
  readLiteral,
  readObject,
  resolveExpression,
  unwrapExpression,
} from "./read-static"

export type VariantLibrary = "cva" | "tv"

export interface Variant {
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

// Where each library takes its config: cva(base, config), cva({ base, ... })
// in the `cva` package, and tv(config).
const factories: Record<
  string,
  { name: string; library: VariantLibrary; config: number }
> = {
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

function getFactory(call: CallExpression) {
  const callee = call.getExpression()
  if (!Node.isIdentifier(callee)) {
    return undefined
  }
  for (const declaration of getDeclarations(callee, { followAliases: false })) {
    if (!Node.isImportSpecifier(declaration)) {
      continue
    }
    const module = declaration.getImportDeclaration().getModuleSpecifierValue()
    const factory = factories[module]
    if (factory?.name === declaration.getName()) {
      return factory
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
        `${name} is nested inside the variants of ${definition.name}, so it's read as a variant. Move it next to variants.`
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
