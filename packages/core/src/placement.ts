import type { Op } from "@pliantui/contract"

import { identityOf, parentOf } from "./node-identity"

/** An item's position in its container; see `ResolvedItemPlacement.position`. */
export type PlacementPosition =
  | { readonly before: string }
  | { readonly after: string }
  | { readonly index: number }
  | { readonly pin: "start" | "end" | "sticky" | "none" }
  | { readonly promoted: boolean }

/**
 * Where an item sits: the node that holds it and its position there.
 *
 * `move … into` and wrap membership set `container`. `pin`, reorder (`move`
 * with `before`, `after` or `index`), `promote` and `demote` keep the
 * container of the item's placement that holds, else its base parent (where
 * an `insert` or `wrap` created it, a wrapper's own target, or the parent in
 * its address), and set only `position`. When that base parent was removed,
 * the container is wherever the removed node's chain resolves at the end
 * (see `ResolvedItemPlacement`).
 */
export interface ResolvedPlacement {
  /** The identity of the node that holds the item. */
  readonly container: string
  /**
   * The item's position in `container`:
   * - `before`, `after` or `index` from a reorder;
   * - `index` from wrap membership: the item's place in the wrap's `items`;
   * - `pin` from `pin`, where `"none"` unpins;
   * - `promoted`: `true` from `promote`, `false` from `demote`.
   *
   * Absent after `move … into`, or when no placement op holds and the item
   * is in its base parent; the container's own order applies.
   */
  readonly position?: PlacementPosition
}

/**
 * The placement an op gives the item at `address`, or undefined for an op
 * that doesn't place items. `current` is the item's current container, which
 * `pin`, reorder, `promote` and `demote` keep: the caller passes the
 * container of the item's placement that holds, else its base parent, which
 * stands in for the end of a removed-parent chain when the placement follows
 * the base. Without one, it is the parent in the op's own target.
 */
export function placementOf(
  op: Op,
  address: string,
  current: string | undefined
): ResolvedPlacement | undefined {
  const container = current ?? parentOf(op.target)
  switch (op.op) {
    case "wrap":
      return {
        container: op.id,
        position: { index: op.items.indexOf(address) },
      }
    case "move":
      return "into" in op.to
        ? { container: identityOf(op.to.into) }
        : { container, position: { ...op.to } }
    case "pin":
      return { container, position: { pin: op.where } }
    case "promote":
    case "demote":
      return { container, position: { promoted: op.op === "promote" } }
    default:
      return undefined
  }
}
