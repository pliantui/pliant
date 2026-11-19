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
 * string. Two overlays of one layer with the same key write exactly the same
 * values, so the later one can replace the earlier one. `undefined` when an
 * op isn't valid or depends on history (see `dependsOnHistory`): replacing
 * such an op changes what it leaves behind, such as a pin after a move into
 * another node, which keeps the item there.
 */
export function changeKeyOf(overlay: LoadedOverlay) {
  const keys = new Set<string>()
  for (const check of overlay.ops) {
    if (check.status !== "valid" || dependsOnHistory(check.op)) {
      return undefined
    }
    for (const { address, property, breakpoint } of opProperties(check.op)) {
      keys.add(JSON.stringify([address, property, breakpoint ?? null]))
    }
  }
  return [...keys].sort().join("\n")
}

/**
 * Whether an op's effect depends on the order of placements and insertions:
 * resolution keeps every place an item has been, so later anchors on it
 * still hold, and a `remove` undoes only what its scope added. Dropping
 * such an op, or moving another below it, can change what other ops do.
 */
export function dependsOnHistory(op: Op) {
  return (
    op.op === "remove" ||
    op.op === "removeUserItem" ||
    opProperties(op).some(
      ({ property }) => property === "placement" || property === "inserted"
    )
  )
}
