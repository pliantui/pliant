import type { Op } from "@pliantui/contract"

import type { LayerTools } from "./layer-tools"

declare const __PLIANT_CORE_VERSION__: string

/**
 * An overlay made in this tab, before it is validated. The manifest
 * versions aren't known here, so `basis.manifests` is empty.
 */
export function manualOverlay(
  { surface, generateId }: LayerTools,
  layer: "personal" | "session",
  ops: readonly Op[],
  time: number,
  explain?: readonly string[]
) {
  return {
    v: 1,
    id: generateId(time),
    surface,
    layer,
    ops: [...ops],
    basis: { contract: 1, core: __PLIANT_CORE_VERSION__, manifests: {} },
    source: "manual",
    ...(explain ? { explain: [...explain] } : {}),
    createdBy: "local",
    createdAt: new Date(time).toISOString(),
  }
}
