import type { Layer, Op } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import { opProperty } from "./op-property"

export interface ResolvedOp {
  op: Op
  index: number
  layer: Layer
  overlay: LoadedOverlay
}

export interface SkippedOp {
  check: Exclude<OpCheck, { status: "valid" }>
  overlay: LoadedOverlay
}

export interface ResolvedLayers {
  ops: ReadonlyMap<string, ReadonlyMap<string, ResolvedOp>>
  skipped: readonly SkippedOp[]
}

const precedence: Readonly<Record<Layer, number>> = {
  org: 0,
  team: 1,
  personal: 2,
  session: 3,
}

export function resolveLayers(
  overlays: readonly LoadedOverlay[]
): ResolvedLayers {
  const ops = new Map<string, Map<string, ResolvedOp>>()
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
      const properties = ops.get(address) ?? new Map<string, ResolvedOp>()
      properties.set(property, {
        op: check.op,
        index: check.index,
        layer: overlay.layer,
        overlay,
      })
      ops.set(address, properties)
    }
  }
  return { ops, skipped }
}
