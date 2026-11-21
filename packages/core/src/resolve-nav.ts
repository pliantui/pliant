import { resolveItems } from "./resolve-items"
import type { ResolvedLayers } from "./resolve-layers"
import type { RegionEntry } from "./resolve-region"

/** What a nav renders, from `resolveNav`. */
export interface ResolvedNav {
  /**
   * The nav's items in render order, hidden ones included, as region
   * entries of kind `slot` whose `id` is the item's id.
   */
  readonly entries: readonly Extract<RegionEntry, { kind: "slot" }>[]
  /**
   * The item `setLanding` makes the landing page, or `undefined` when no
   * overlay sets one, or the one it sets is hidden or isn't in `items`.
   */
  readonly landing: string | undefined
}

/** The nav `resolveNav` resolves. */
export interface ResolveNavOptions {
  /** The nav's node id. */
  readonly id: string
  /** The nav's item ids in base order. */
  readonly items: readonly string[]
}

/**
 * Resolves a nav's items from the resolved layers: their order, each item's
 * visibility, pin and collapse, and the landing item. Items are the
 * `items` collection of the nav (`app-sidebar/items/reports`); ops on ids
 * that aren't in `items` are ignored, and repeated ids count once.
 *
 * Items never leave their nav, so the order is the base order with each
 * item's position applied as `orderItems` does, hidden items included. The
 * landing must be an item the user can reach, so a landing on a hidden
 * item resolves to `undefined`, and the app's own start page applies. A
 * collapsed item is still reachable, so it can be the landing.
 */
export function resolveNav(
  layers: Pick<ResolvedLayers, "properties" | "placements">,
  { id, items }: ResolveNavOptions
): ResolvedNav {
  const entries = resolveItems(layers, id, "items", items)
  const setLanding = layers.properties.get(id)?.get("landing")?.winner.check.op
  const landing =
    setLanding?.op === "setLanding"
      ? setLanding.target.slice(setLanding.target.lastIndexOf("/") + 1)
      : undefined
  return {
    entries,
    landing: entries.find((entry) => entry.visible && entry.id === landing)?.id,
  }
}
