import { useLayoutEffect, useState, type ReactNode } from "react"

import { createLayerStore } from "./layer-store"
import { localAdapter } from "./local-adapter"
import { PliantContext } from "./pliant-context"
import type { StorageAdapter } from "./storage-adapter"

/** @experimental */
export interface PliantRootProps {
  /** The surface the layers belong to: a route pattern or a surface id. */
  readonly surface: string
  /**
   * Where the layers are loaded from and personal overlays saved to.
   * Defaults to `localAdapter()`. It is read once, when the surface mounts,
   * and must be created in client code: an object of functions can't be
   * passed from a Server Component.
   */
  readonly storage?: StorageAdapter | undefined
  /** Team ids, highest precedence first, as in core's `resolveLayers`. */
  readonly teamOrder?: readonly string[] | undefined
  /**
   * Called when saving a personal version fails. The version stays pending
   * and is saved again on the next flush. Defaults to `console.error`.
   */
  readonly onError?: ((error: unknown) => void) | undefined
  readonly children?: ReactNode
}

function PliantSurfaceRoot({
  surface,
  storage,
  teamOrder = [],
  onError,
  children,
}: PliantRootProps) {
  const [store] = useState(() =>
    createLayerStore({
      surface,
      storage: storage ?? localAdapter(),
      teamOrder,
      onError,
    })
  )
  useLayoutEffect(() => {
    store.setOnError(onError)
  }, [store, onError])
  useLayoutEffect(() => {
    store.setTeamOrder(teamOrder)
  }, [store, teamOrder])
  const [, setConnections] = useState(0)
  useLayoutEffect(() => {
    // Hooks subscribe to the store in passive effects, after this one, so
    // they would miss what connecting loads. An update from a layout effect
    // makes React render again before the browser paints.
    const unsubscribe = store.subscribe(() => {
      setConnections((count) => count + 1)
    })
    const disconnect = store.connect()
    unsubscribe()
    return disconnect
  }, [store])
  return <PliantContext value={store}>{children}</PliantContext>
}

/**
 * Holds the layers of one surface: org and team overlays from `storage`,
 * personal overlays saved to it, and the session layer, kept per tab. It
 * reads storage only after mount, in a layout effect, so the server render
 * resolves no overlays and a synchronous adapter applies before the first
 * client paint. `usePliantStatus` tells when the layers are ready.
 *
 * Each tab loads the layers once: changes made in another tab show after a
 * reload.
 *
 * @experimental
 */
export function PliantRoot(props: PliantRootProps) {
  return <PliantSurfaceRoot key={props.surface} {...props} />
}
