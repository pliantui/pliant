import type { Layer } from "@pliantui/contract"

import type { LoadedOverlay } from "./load-overlay"

const layerRank: Readonly<Record<Layer, number>> = {
  org: 0,
  team: 1,
  personal: 2,
  session: 3,
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function scopeOf(overlay: LoadedOverlay): string {
  switch (overlay.layer) {
    case "org":
      return overlay.scope.org
    case "team":
      return overlay.scope.team
    default:
      return ""
  }
}

/**
 * Orders overlays lowest precedence first: by layer, then, within the team
 * layer, by `teamOrder` (highest precedence first; unlisted teams rank below
 * listed ones), then by scope id, `createdAt` and overlay id.
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
      scope: scopeOf(overlay),
      createdAt: Date.parse(overlay.createdAt),
    }))
    .sort(
      (a, b) =>
        a.layer - b.layer ||
        a.team - b.team ||
        compareText(a.scope, b.scope) ||
        a.createdAt - b.createdAt ||
        compareText(a.overlay.id, b.overlay.id)
    )
    .map(({ overlay }) => overlay)
}
