import { useLayerStore } from "./pliant-context"

/**
 * The surface of the nearest `PliantRoot`, for example to send with an ask.
 *
 * @experimental
 */
export function usePliantSurface(): string {
  return useLayerStore("usePliantSurface").surface
}
