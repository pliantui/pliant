import { useSyncExternalStore } from "react"

import { loadingStatus, type PliantStatus } from "./layer-store"
import { useLayerStore } from "./pliant-context"

function getServerStatus() {
  return loadingStatus
}

/**
 * Whether the surface's layers have loaded: `loading` on the server and
 * until the storage adapter answers, then `ready`, or `error` when loading
 * failed (`usePliantStore().reload()` tries again). A synchronous adapter,
 * such as `localAdapter`, is `ready` before the first client paint.
 *
 * @experimental
 */
export function usePliantStatus(): PliantStatus {
  const store = useLayerStore("usePliantStatus")
  return useSyncExternalStore(store.subscribe, store.getStatus, getServerStatus)
}
