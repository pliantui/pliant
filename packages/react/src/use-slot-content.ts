import { useCallback, useSyncExternalStore, type ReactNode } from "react"

import { useLayerStore } from "./pliant-context"

function getServerContent(): ReactNode {
  return undefined
}

/**
 * The content of the slot `id`, from the mounted region that declares it
 * with `useRegionSlots`, or `undefined`. On the server, no region has
 * mounted, so it is always `undefined`.
 *
 * @experimental
 */
export function useSlotContent(id: string): ReactNode {
  const store = useLayerStore("useSlotContent")
  const subscribe = useCallback(
    (listener: () => void) => store.slots.subscribe(id, listener),
    [store, id]
  )
  return useSyncExternalStore(
    subscribe,
    () => store.slots.getContent(id),
    getServerContent
  )
}
