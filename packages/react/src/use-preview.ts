import { useSyncExternalStore } from "react"

import type { LoadedOverlay } from "@pliantui/core"

import { useLayerStore } from "./pliant-context"

function getServerPreview() {
  return null
}

/**
 * The overlay being previewed, or `null`. A preview survives a reload of the
 * tab.
 *
 * @experimental
 */
export function usePreview(): LoadedOverlay | null {
  const store = useLayerStore("usePreview")
  return useSyncExternalStore(
    store.subscribe,
    store.getPreview,
    getServerPreview
  )
}
