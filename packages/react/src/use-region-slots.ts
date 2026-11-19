import { useLayoutEffect, useMemo, type ReactNode } from "react"

import { useLayerStore } from "./pliant-context"

/**
 * Declares a region while the calling component is mounted: registers its
 * id and slot ids as mounted nodes, and shares each slot's content so a
 * region an op moves the slot into can render it with `useSlotContent`.
 * The base order is the key order of `slots`.
 *
 * In development, warns about slot ids that aren't kebab-case or don't start
 * with a letter, and about region or slot ids another mounted region uses.
 *
 * @experimental
 */
export function useRegionSlots(
  id: string,
  slots: Readonly<Record<string, ReactNode>>
) {
  const store = useLayerStore("useRegionSlots")
  const key = [id, ...Object.keys(slots)].join("\n")
  const ids = useMemo(() => key.split("\n"), [key])
  useLayoutEffect(() => store.registerNodes(ids), [store, ids])
  useLayoutEffect(() => store.slots.declare(id, slots), [store, id, slots])
}
