import type { Op } from "@pliantui/contract"
import { opProperties, type LoadedOverlay } from "@pliantui/core"

/** The (identity, property) pairs an op writes, one string each. */
export function propertiesOf(op: Op) {
  return opProperties(op).map(({ address, property }) =>
    JSON.stringify([address, property])
  )
}

/**
 * The (identity, property, breakpoint) triples an overlay writes, as one
 * string, or `undefined` when an op isn't valid. Two overlays of one layer
 * with the same key write exactly the same values, so the later one can
 * replace the earlier one.
 */
export function changeKeyOf(overlay: LoadedOverlay) {
  const keys = new Set<string>()
  for (const check of overlay.ops) {
    if (check.status !== "valid") {
      return undefined
    }
    for (const { address, property, breakpoint } of opProperties(check.op)) {
      keys.add(JSON.stringify([address, property, breakpoint ?? null]))
    }
  }
  return [...keys].sort().join("\n")
}
