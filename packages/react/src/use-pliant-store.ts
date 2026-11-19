import type { PliantStore } from "./layer-store"
import { useLayerStore } from "./pliant-context"

/**
 * Applies ops to, previews on, and locks in or discards from the surface of
 * the nearest `PliantRoot`. The returned object never changes.
 *
 * @experimental
 */
export function usePliantStore(): PliantStore {
  return useLayerStore("usePliantStore").actions
}
