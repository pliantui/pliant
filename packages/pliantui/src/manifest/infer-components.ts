import type { CallExpression, Node, SourceFile } from "ts-morph"

import { classifyValues } from "./classify"
import { findComponents, type Component } from "./component"
import { describeComponent } from "./describe-component"
import { createDiagnostic, type Diagnostic } from "./diagnostic"
import { followProps } from "./follow-props"
import type { InferredComponent } from "./inferred-component"
import { readDefaults } from "./read-defaults"
import { readJsx } from "./read-jsx"
import { readUnionProps } from "./read-union-props"
import { readVariantCalls, type ContextConsumer } from "./read-variant-calls"
import type { VariantDefinition } from "./variant-definition"

export function inferComponents(
  sourceFiles: SourceFile[],
  diagnostics: Diagnostic[],
  cwd: string
): InferredComponent[] {
  const components = findComponents(sourceFiles, diagnostics, cwd)
  const byDeclaration = new Map<Node, Component>()
  for (const component of components) {
    if (!byDeclaration.has(component.declaration)) {
      byDeclaration.set(component.declaration, component)
    }
  }

  const definitions = new Map<CallExpression, VariantDefinition>()
  const consumers = new Map<Node, Map<string, ContextConsumer[]>>()
  for (const component of components) {
    readVariantCalls(component, definitions, consumers, diagnostics)
    readJsx(component, byDeclaration)
  }

  for (let round = 0, changed = true; changed && round < 10; round++) {
    changed = false
    for (const component of components) {
      changed = followProps(component, consumers) || changed
    }
  }

  const providers = new Map<Node, string[]>()
  for (const component of components) {
    for (const { context } of component.provides) {
      const names = providers.get(context) ?? []
      if (!names.includes(component.name)) {
        providers.set(context, [...names, component.name])
      }
    }
  }

  return components.flatMap((component) => {
    readUnionProps(component)
    const defaults = readDefaults(component, diagnostics)
    for (const [name, conflict] of component.defaultConflicts) {
      const prop = component.props.get(name)
      if (prop) {
        prop.default = undefined
      }
      diagnostics.push(
        createDiagnostic(
          component.declaration,
          `${component.name}'s ${name} gets different defaults from different variant definitions (${[...conflict].join(", ")}), so no default is set.`
        )
      )
    }
    if (
      !component.usesVariants &&
      component.props.size === 0 &&
      component.unreadable.size === 0 &&
      component.variantsReadable &&
      defaults.length === 0
    ) {
      return []
    }
    return [
      {
        name: component.name,
        file: component.declaration.getSourceFile().getFilePath(),
        description: describeComponent(component),
        variantsReadable: component.variantsReadable,
        usesVariants: component.usesVariants,
        label: true,
        hideable: true,
        unreadableProps: [...component.unreadable].filter(
          (prop) => !component.props.has(prop)
        ),
        props: [...component.props].map(([name, prop]) => {
          const classes = classifyValues(name, prop.values, {
            boolean: prop.boolean,
            fromUnion: prop.source === "union",
          })
          return {
            name,
            source: prop.source,
            boolean: prop.boolean,
            overriddenBy: (prop.contexts ?? []).flatMap(
              (context) => providers.get(context) ?? []
            ),
            values: prop.values.map((value, index) => ({
              value,
              class: classes[index] ?? "confirm",
              decided: false,
            })),
            ...(prop.default === undefined ? {} : { default: prop.default }),
          }
        }),
        defaults,
      },
    ]
  })
}
