import type { Node } from "ts-morph"

import { addProp, getDefault, type Component } from "./component"
import type { ContextConsumer } from "./read-variant-calls"

export function followProps(
  component: Component,
  consumers: Map<Node, Map<string, ContextConsumer[]>>
) {
  let changed = false
  for (const { target, targetProp, binding } of component.passes) {
    const prop = target.props.get(targetProp)
    if (!prop || prop.source === "union") {
      continue
    }
    changed =
      addProp(component, binding.prop, {
        source: "pass-through",
        values: [...prop.values],
        boolean: prop.boolean,
        default: getDefault(binding, prop.values, prop.default),
      }) || changed
  }

  const destructured = new Set(
    [...component.bindings.values()].map((binding) => binding.prop)
  )
  for (const { target, rest, overridden, presets } of component.spreads) {
    const restType = rest.getType()
    for (const [name, prop] of target.props) {
      if (
        prop.source === "union" ||
        overridden.has(name) ||
        destructured.has(name) ||
        !restType.getProperty(name)
      ) {
        continue
      }
      changed =
        addProp(component, name, {
          source: "pass-through",
          values: [...prop.values],
          boolean: prop.boolean,
          default: getDefault(
            { prop: name },
            prop.values,
            presets.get(name) ?? prop.default
          ),
        }) || changed
    }
  }

  for (const { context, key, binding } of component.provides) {
    for (const { definition, variant } of consumers.get(context)?.get(key) ??
      []) {
      const found = definition.variants.get(variant)
      if (!found) {
        continue
      }
      changed =
        addProp(component, binding.prop, {
          source: "context",
          values: [...found.values],
          boolean: found.boolean,
          default: getDefault(
            binding,
            found.values,
            definition.defaults.get(variant)
          ),
        }) || changed
    }
  }
  return changed
}
