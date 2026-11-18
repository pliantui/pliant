import type { Layer } from "@pliantui/contract"

import { compareInstants, parseInstant } from "./instant"
import type { LoadedOverlay } from "./load-overlay"
import { scopeIdOf } from "./overlay-scope"

const layerRank: Readonly<Record<Layer, number>> = {
  org: 0,
  team: 1,
  personal: 2,
  session: 3,
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Orders overlays lowest precedence first, so a later overlay wins: by layer,
 * then, within the team layer, by `teamOrder` (highest precedence first;
 * unlisted teams rank below listed ones), then by ascending scope id,
 * `createdAt` and overlay id. Overlays that tie on all of these (a duplicate
 * id) are ordered by their content, so the order never depends on the input.
 */
export function orderOverlays(
  overlays: readonly LoadedOverlay[],
  teamOrder: readonly string[]
): LoadedOverlay[] {
  const teamRank = new Map<string, number>()
  teamOrder.forEach((team, index) => {
    if (!teamRank.has(team)) {
      teamRank.set(team, teamOrder.length - index)
    }
  })
  return overlays
    .map((overlay) => ({
      overlay,
      layer: layerRank[overlay.layer],
      team:
        overlay.layer === "team" ? (teamRank.get(overlay.scope.team) ?? 0) : 0,
      scope: scopeIdOf(overlay),
      createdAt: parseInstant(overlay.createdAt),
    }))
    .sort(
      (a, b) =>
        a.layer - b.layer ||
        a.team - b.team ||
        compareText(a.scope, b.scope) ||
        compareInstants(a.createdAt, b.createdAt) ||
        compareText(a.overlay.id, b.overlay.id) ||
        compareText(JSON.stringify(a.overlay), JSON.stringify(b.overlay))
    )
    .map(({ overlay }) => overlay)
}
