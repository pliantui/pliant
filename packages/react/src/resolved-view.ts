import type { ResolvedLayers } from "@pliantui/core"

import { propertiesOf } from "./property-keys"
import { stableJson } from "./stable-json"

interface ViewEntry {
  readonly value: string
  /** The `propertiesOf` keys the entry is about. */
  readonly properties: readonly string[]
}

/**
 * What the user sees from resolved layers, independent of which overlay
 * each value came from: the winning op of every property (and of every
 * breakpoint for layouts), where every placed item sits, and which ops
 * don't apply and why.
 */
export function viewOf({ properties, placements, unapplied }: ResolvedLayers) {
  const view = new Map<string, ViewEntry>()
  for (const [identity, byProperty] of properties) {
    for (const [property, { winner, breakpoints }] of byProperty) {
      const key = JSON.stringify([identity, property])
      view.set(key, {
        value: stableJson([
          winner.check.op,
          [...(breakpoints ?? [])].map(([at, { check }]) => [at, check.op]),
        ]),
        properties: [key],
      })
    }
  }
  for (const [identity, { container, position }] of placements) {
    const key = JSON.stringify([identity, "placement"])
    view.set(key, {
      value: stableJson([container, position]),
      properties: [key],
    })
  }
  for (const { check, reason } of unapplied) {
    const key = `unapplied:${stableJson([check.op, reason])}`
    const count = Number(view.get(key)?.value ?? 0) + 1
    view.set(key, { value: String(count), properties: propertiesOf(check.op) })
  }
  return view
}

/** The `propertiesOf` keys where two views differ. */
export function differingProperties(
  a: ReadonlyMap<string, ViewEntry>,
  b: ReadonlyMap<string, ViewEntry>
) {
  const differing = new Set<string>()
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const entry = a.get(key)
    const other = b.get(key)
    if (entry?.value !== other?.value) {
      for (const property of entry?.properties ?? other?.properties ?? []) {
        differing.add(property)
      }
    }
  }
  return differing
}
