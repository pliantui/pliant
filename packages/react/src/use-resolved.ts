import { useSyncExternalStore } from "react"

import type { ResolvedLayers } from "@pliantui/core"

import { useLayerStore } from "./pliant-context"

/**
 * The surface's layers resolved with core's `resolveLayers`, with the
 * mounted nodes as `baseIds`. The same object is returned until a layer or
 * the mounted nodes change.
 *
 * @experimental
 */
export function useResolved(): ResolvedLayers {
  const store = useLayerStore("useResolved")
  return useSyncExternalStore(
    store.subscribe,
    store.getResolved,
    store.getServerResolved
  )
}
