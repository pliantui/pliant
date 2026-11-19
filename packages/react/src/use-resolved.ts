import { useMemo, useSyncExternalStore } from "react"

import type { ResolvedLayers } from "@pliantui/core"

import { memoizeSelector } from "./memoize-selector"
import { useLayerStore } from "./pliant-context"

function identity(resolved: ResolvedLayers): unknown {
  return resolved
}

/**
 * The surface's layers resolved with core's `resolveLayers`, with the
 * mounted nodes as `baseIds`. The same object is returned until a layer or
 * the mounted nodes change.
 *
 * With a `selector`, returns its result instead, and re-renders only when
 * `isEqual` (default `Object.is`) says it changed. Pass a stable selector
 * (defined outside the component, or memoized) so its last result is kept
 * between renders; the React Compiler memoizes inline ones.
 *
 * @experimental
 */
export function useResolved(): ResolvedLayers
export function useResolved<T>(
  selector: (resolved: ResolvedLayers) => T,
  isEqual?: (a: T, b: T) => boolean
): T
export function useResolved(
  selector: (resolved: ResolvedLayers) => unknown = identity,
  isEqual: (a: unknown, b: unknown) => boolean = Object.is
): unknown {
  const store = useLayerStore("useResolved")
  const select = useMemo(
    () => memoizeSelector(selector, isEqual),
    [selector, isEqual]
  )
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getResolved()),
    () => select(store.getServerResolved())
  )
}
