import { Node, SyntaxKind, type CallExpression } from "ts-morph"

import {
  addProp,
  fallbackOperators,
  getBinding,
  getDefault,
  isCallTo,
  isPropsObject,
  type Component,
} from "./component"
import { createDiagnostic, type Diagnostic } from "./diagnostic"
import {
  getDeclarations,
  readLiteral,
  readPropertyKey,
  unwrapExpression,
} from "./read-static"
import {
  getUntracedVariantCall,
  getVariantCall,
  readVariantDefinition,
  type VariantDefinition,
} from "./variant-definition"

export interface ContextConsumer {
  definition: VariantDefinition
  variant: string
}

function getContextKeys(node: Node): { context: Node; key: string }[] {
  const expression = Node.isShorthandPropertyAssignment(node)
    ? node
    : unwrapExpression(node)
  if (
    Node.isBinaryExpression(expression) &&
    fallbackOperators.has(expression.getOperatorToken().getKind())
  ) {
    return [
      ...getContextKeys(expression.getLeft()),
      ...getContextKeys(expression.getRight()),
    ]
  }
  if (!Node.isPropertyAccessExpression(expression)) {
    return []
  }
  const object = expression.getExpression()
  if (!Node.isIdentifier(object)) {
    return []
  }
  const declaration = getDeclarations(object, { followAliases: false })[0]
  const initializer = Node.isVariableDeclaration(declaration)
    ? declaration.getInitializer()
    : undefined
  const call = initializer && unwrapExpression(initializer)
  if (!Node.isCallExpression(call) || !isCallTo(call, ["useContext", "use"])) {
    return []
  }
  const argument = call.getArguments()[0]
  const context = argument && getDeclarations(argument)[0]
  return context ? [{ context, key: expression.getName() }] : []
}

export function readVariantCalls(
  component: Component,
  definitions: Map<CallExpression, VariantDefinition>,
  consumers: Map<Node, Map<string, ContextConsumer[]>>,
  diagnostics: Diagnostic[]
) {
  for (const call of component.fn.getDescendantsOfKind(
    SyntaxKind.CallExpression
  )) {
    const variantCall = getVariantCall(call.getExpression())
    if (!variantCall) {
      const untraced = getUntracedVariantCall(call.getExpression())
      if (untraced) {
        const diagnostic = createDiagnostic(
          untraced,
          `${untraced.getExpression().getText()}() here can't be traced to class-variance-authority or tailwind-variants, so its variants aren't read.`
        )
        if (
          !diagnostics.some(
            (found) =>
              found.file === diagnostic.file && found.line === diagnostic.line
          )
        ) {
          diagnostics.push(diagnostic)
        }
      }
      continue
    }
    const definition = readVariantDefinition(
      variantCall,
      diagnostics,
      definitions
    )
    if (!definition.readable) {
      component.variantsReadable = false
      continue
    }
    const argument = call.getArguments()[0]
    if (!argument) {
      continue
    }

    // Spreading the props passes every variant through, except keys written
    // after the spread. Literal keys written before it are the defaults.
    const addAll = (
      overridden = new Set<string>(),
      presets = new Map<string, string>()
    ) => {
      for (const name of definition.unreadable) {
        if (!overridden.has(name)) {
          component.unreadable.add(name)
        }
      }
      for (const [name, variant] of definition.variants) {
        if (overridden.has(name)) {
          continue
        }
        const preset = presets.get(name)
        const fallback = preset ?? definition.defaults.get(name)
        addProp(component, name, {
          source: definition.library,
          values: [...variant.values],
          boolean: variant.boolean,
          default:
            fallback !== undefined && variant.values.includes(fallback)
              ? fallback
              : undefined,
        })
      }
    }
    if (isPropsObject(component, argument)) {
      addAll()
      continue
    }
    const object = unwrapExpression(argument)
    if (!Node.isObjectLiteralExpression(object)) {
      continue
    }
    const properties = object.getProperties()
    const keyOf = (property: Node) =>
      Node.isPropertyAssignment(property) ||
      Node.isShorthandPropertyAssignment(property)
        ? readPropertyKey(property.getNameNode())
        : undefined
    for (const [index, property] of properties.entries()) {
      if (Node.isSpreadAssignment(property)) {
        if (isPropsObject(component, property.getExpression())) {
          const overridden = new Set(
            properties
              .slice(index + 1)
              .map(keyOf)
              .filter((key) => key !== undefined)
          )
          const presets = new Map<string, string>()
          for (const earlier of properties.slice(0, index)) {
            const key = keyOf(earlier)
            const literal = Node.isPropertyAssignment(earlier)
              ? readLiteral(earlier.getInitializerOrThrow())
              : undefined
            if (key !== undefined && literal !== undefined) {
              presets.set(key, String(literal))
            }
          }
          addAll(overridden, presets)
        }
        continue
      }
      if (
        !Node.isPropertyAssignment(property) &&
        !Node.isShorthandPropertyAssignment(property)
      ) {
        continue
      }
      const key = readPropertyKey(property.getNameNode())
      const value = Node.isPropertyAssignment(property)
        ? property.getInitializer()
        : property
      if (key === undefined || !value) {
        continue
      }
      const binding = getBinding(component, value)
      if (definition.unreadable.has(key)) {
        if (binding) {
          component.unreadable.add(binding.prop)
        }
        continue
      }
      const variant = definition.variants.get(key)
      if (!variant) {
        continue
      }
      if (binding) {
        addProp(component, binding.prop, {
          source: definition.library,
          values: [...variant.values],
          boolean: variant.boolean,
          default: getDefault(
            binding,
            variant.values,
            definition.defaults.get(key)
          ),
        })
      }
      for (const { context, key: contextKey } of getContextKeys(value)) {
        const byKey =
          consumers.get(context) ?? new Map<string, ContextConsumer[]>()
        consumers.set(context, byKey)
        byKey.set(contextKey, [
          ...(byKey.get(contextKey) ?? []),
          { definition, variant: key },
        ])
      }
    }
  }
}
