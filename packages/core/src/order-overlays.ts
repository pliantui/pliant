import type { Layer } from "@pliantui/contract"

import { compareData } from "./compare-data"
import { compareOrdered } from "./compare-ordered"
import { compareInstants, parseInstant, type Instant } from "./instant"
import type { LoadedOverlay } from "./load-overlay"
import { scopeIdOf } from "./overlay-scope"

const layerRank: Readonly<Record<Layer, number>> = {
  org: 0,
  team: 1,
  personal: 2,
  session: 3,
}

interface Keyed {
  readonly overlay: LoadedOverlay
  readonly layer: number
  readonly team: number
  readonly scope: string
  readonly createdAt: Instant | undefined
}

function compareKeys(a: Keyed, b: Keyed): number {
  return (
    a.layer - b.layer ||
    a.team - b.team ||
    compareOrdered(a.scope, b.scope) ||
    compareInstants(a.createdAt, b.createdAt) ||
    compareOrdered(a.overlay.id, b.overlay.id)
  )
}

/** The overlay as the data it was loaded from, with each op as given. */
export function contentOf(overlay: LoadedOverlay): unknown {
  return { ...overlay, ops: overlay.ops.map(({ op }) => op) }
}

/**
 * Orders overlays lowest precedence first, so a later overlay wins: by layer,
 * then, within the team layer, by `teamOrder` (highest precedence first;
 * unlisted teams rank below listed ones), then by ascending scope id,
 * `createdAt` and overlay id.
 *
 * Returns groups of overlays that tie on all of these, which only overlays
 * with the same id can do. Within a group, overlays are ordered by their
 * content, and identical ones keep their input order.
 */
export function orderOverlays(
  overlays: readonly LoadedOverlay[],
  teamOrder: readonly string[]
): LoadedOverlay[][] {
  const teamRank = new Map<string, number>()
  teamOrder.forEach((team, index) => {
    if (!teamRank.has(team)) {
      teamRank.set(team, teamOrder.length - index)
    }
  })
  const sorted = overlays
    .map((overlay): Keyed => ({
      overlay,
      layer: layerRank[overlay.layer],
      team:
        overlay.layer === "team" ? (teamRank.get(overlay.scope.team) ?? 0) : 0,
      scope: scopeIdOf(overlay),
      createdAt: parseInstant(overlay.createdAt),
    }))
    .sort(
      (a, b) =>
        compareKeys(a, b) ||
        // Contents with no order compare as NaN and keep their input order.
        compareData(contentOf(a.overlay), contentOf(b.overlay)) ||
        0
    )
  const groups: LoadedOverlay[][] = []
  sorted.forEach((keyed, index) => {
    const previous = sorted[index - 1]
    const group = groups.at(-1)
    if (group && previous && compareKeys(previous, keyed) === 0) {
      group.push(keyed.overlay)
    } else {
      groups.push([keyed.overlay])
    }
  })
  return groups
}
