import { useEffect, useState, type ReactNode } from "react"

import { createLayerStore } from "./layer-store"
import { localAdapter } from "./local-adapter"
import { PliantContext } from "./pliant-context"
import type { StorageAdapter } from "./storage-adapter"

/** @experimental */
export interface PliantRootProps {
  /** The surface the layers belong to: a route pattern or a surface id. */
  readonly surface: string
  /**
   * Where the layers are loaded from and personal overlays saved to, read
   * when the surface mounts. Defaults to `localAdapter()`.
   */
  readonly storage?: StorageAdapter | undefined
  /** Team ids, highest precedence first, as in core's `resolveLayers`. */
  readonly teamOrder?: readonly string[] | undefined
  readonly children?: ReactNode
}

function PliantSurfaceRoot({
  surface,
  storage,
  teamOrder = [],
  children,
}: PliantRootProps) {
  const [store] = useState(() =>
    createLayerStore({
      surface,
      storage: storage ?? localAdapter(),
      teamOrder,
    })
  )
  useEffect(() => store.connect(), [store])
  useEffect(() => {
    store.setTeamOrder(teamOrder)
  }, [store, teamOrder])
  return <PliantContext value={store}>{children}</PliantContext>
}

/**
 * Holds the layers of one surface: org and team overlays from `storage`,
 * personal overlays saved to it, and the session layer, kept per tab. It
 * reads storage only after mount, so server rendering resolves no overlays.
 *
 * @experimental
 */
export function PliantRoot(props: PliantRootProps) {
  return <PliantSurfaceRoot key={props.surface} {...props} />
}
