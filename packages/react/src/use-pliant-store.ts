import { useLayerStore } from "./pliant-context"
import type { PliantStore } from "./pliant-store"

/**
 * Applies ops to, previews on, and locks in or discards from the surface of
 * the nearest `PliantRoot`. The returned object never changes.
 *
 * @experimental
 */
export function usePliantStore(): PliantStore {
  return useLayerStore("usePliantStore").actions
}
