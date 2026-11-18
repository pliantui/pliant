import type { Op } from "@pliantui/contract"

import { identityOf, parentOf } from "./node-identity"

/**
 * Where an item sits: the node that holds it and its position there.
 *
 * `move … into` and wrap membership set `container`. `pin`, reorder (`move`
 * with `before`, `after` or `index`), `promote` and `demote` keep the
 * container of the placement they replace, else the item's base parent, and
 * set only `position`.
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
   * Absent after `move … into`, or when the item went back to its wrap's
   * target with no earlier placement; the container's own order applies.
   */
  readonly position?:
    | { readonly before: string }
    | { readonly after: string }
    | { readonly index: number }
    | { readonly pin: "start" | "end" | "sticky" | "none" }
    | { readonly promoted: boolean }
}

/**
 * The placement an op gives the item at `address`, on top of the item's
 * `current` placement, or undefined for an op that doesn't place items.
 */
export function placementOf(
  op: Op,
  address: string,
  current: ResolvedPlacement | undefined
): ResolvedPlacement | undefined {
  const container = current?.container ?? parentOf(op.target)
  switch (op.op) {
    case "wrap":
      return {
        container: op.id,
        position: { index: op.items.indexOf(address) },
      }
    case "move":
      return "into" in op.to
        ? { container: identityOf(op.to.into) }
        : { container, position: op.to }
    case "pin":
      return { container, position: { pin: op.where } }
    case "promote":
    case "demote":
      return { container, position: { promoted: op.op === "promote" } }
    default:
      return undefined
  }
}
