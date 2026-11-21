import { useSyncExternalStore } from "react"

import { useLayerStore } from "./pliant-context"

/**
 * Whether the user's personal or session layer changes a node: its
 * properties or those of its items, such as a table's sort or its columns'
 * widths, which `resetNode` drops. Changes in the org and team layers, and
 * the preview, don't count.
 *
 * @experimental
 */
export function usePliantNodeChanged(target: string): boolean {
  const store = useLayerStore("usePliantNodeChanged")
  return useSyncExternalStore(
    store.subscribe,
    () => store.changesNode(target),
    () => store.changesNode(target, true)
  )
}
