import { useMemo, type ReactNode } from "react"

import { resolveRegion, type ResolvedRegion } from "@pliantui/core"

import { usePliantStatus } from "./use-pliant-status"
import { useRegionSlots } from "./use-region-slots"
import { useResolved } from "./use-resolved"

function baseRegion(ids: readonly string[]): ResolvedRegion {
  return {
    layout: {},
    entries: ids.map((id) => ({ kind: "slot", id, visible: true })),
  }
}

/**
 * Declares the region `id` with `useRegionSlots`, and returns what it
 * renders: its layout and its entries, resolved with core's `resolveRegion`.
 * Until the layers load, and on the server, it's the slots in key order with
 * no layout, so the first render matches the server's.
 *
 * Render each list of entries, the region's and each wrapper's, with
 * `useRegionItems`.
 *
 * @experimental
 */
export function usePliantRegion(
  id: string,
  slots: Readonly<Record<string, ReactNode>>
): ResolvedRegion {
  useRegionSlots(id, slots)
  const ready = usePliantStatus().status === "ready"
  const layers = useResolved()
  const key = Object.keys(slots).join("\n")
  return useMemo(() => {
    const ids = key.split("\n").filter(Boolean)
    return ready ? resolveRegion(layers, { id, slots: ids }) : baseRegion(ids)
  }, [ready, layers, id, key])
}
