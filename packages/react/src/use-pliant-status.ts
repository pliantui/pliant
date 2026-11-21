import { useSyncExternalStore } from "react"

import { useLayerStore } from "./pliant-context"
import type { PliantStatus } from "./pliant-status"

/**
 * Whether the surface's layers have loaded: `loading` on the server and
 * until the storage adapter answers, then `ready`, or `error` when loading
 * failed (`usePliantStore().reload()` tries again). A synchronous adapter,
 * such as `localAdapter`, is `ready` before the first client paint. Given
 * `layers`, `PliantRoot` is `ready` from the server render on.
 *
 * @experimental
 */
export function usePliantStatus(): PliantStatus {
  const store = useLayerStore("usePliantStatus")
  return useSyncExternalStore(
    store.subscribe,
    store.getStatus,
    store.getServerStatus
  )
}
