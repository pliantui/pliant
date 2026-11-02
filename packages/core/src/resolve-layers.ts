import type { Layer } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import { opProperty, type OpPropertyKey } from "./op-property"

export interface ResolvedOp {
  check: Extract<OpCheck, { status: "valid" }>
  overlay: LoadedOverlay
}

export interface ResolvedProperty {
  winner: ResolvedOp
  overridden: readonly ResolvedOp[]
}

export interface SkippedOp {
  check: Exclude<OpCheck, { status: "valid" }>
  overlay: LoadedOverlay
}

export interface ResolvedLayers {
  properties: ReadonlyMap<string, ReadonlyMap<OpPropertyKey, ResolvedProperty>>
  skipped: readonly SkippedOp[]
}

const precedence: Readonly<Record<Layer, number>> = {
  org: 0,
  team: 1,
  personal: 2,
  session: 3,
}

/**
 * Resolves the overlays for one surface, plus the @app overlays, into a value
 * per (address, property). Layers apply org, team, personal, session; within a
 * layer, overlays apply in the order given, and within an overlay later ops
 * win. Only valid ops apply. `overridden` lists the ops a property's winner
 * replaced, lowest precedence first, and `skipped` lists non-valid ops in the
 * same order.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[]
): ResolvedLayers {
  const properties = new Map<
    string,
    Map<OpPropertyKey, { winner: ResolvedOp; overridden: ResolvedOp[] }>
  >()
  const skipped: SkippedOp[] = []
  const ordered = overlays.toSorted(
    (a, b) => precedence[a.layer] - precedence[b.layer]
  )
  for (const overlay of ordered) {
    for (const check of overlay.ops) {
      if (check.status !== "valid") {
        skipped.push({ check, overlay })
        continue
      }
      const { address, property } = opProperty(check.op)
      const byProperty =
        properties.get(address) ??
        new Map<
          OpPropertyKey,
          { winner: ResolvedOp; overridden: ResolvedOp[] }
        >()
      const previous = byProperty.get(property)
      if (previous) {
        previous.overridden.push(previous.winner)
        previous.winner = { check, overlay }
      } else {
        byProperty.set(property, { winner: { check, overlay }, overridden: [] })
      }
      properties.set(address, byProperty)
    }
  }
  return { properties, skipped }
}
