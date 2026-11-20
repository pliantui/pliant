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
   * Called when saving a personal version fails, and when loading the
   * layers again after a change elsewhere fails, which keeps the layers
   * shown. A failed version stays pending and is saved again on the next
   * flush. A conflict Pliant resolves isn't reported (see `PliantRoot`).
   * Defaults to `console.error`.
   */
  readonly onError?: ((error: unknown) => void) | undefined
  /**
   * The UI language as a BCP 47 tag, such as `"fr-CA"`. Overlays made in
   * this tab, and AI previews locked in without a language, record it as
   * the language of their labels. Defaults to the page's `<html lang>`.
   * Set it when the app localizes without changing `<html lang>`. A
   * malformed tag is ignored, with a warning in development.
   */
  readonly lang?: string | undefined
  readonly children?: ReactNode
}

function PliantSurfaceRoot({
  surface,
  storage,
  teamOrder = [],
  onError,
  lang,
  children,
}: PliantRootProps) {
  const [store] = useState(() =>
    createLayerStore({
      surface,
      storage: storage ?? localAdapter(),
      teamOrder,
      onError,
      lang,
    })
  )
  useLayoutEffect(() => {
    store.setOnError(onError)
  }, [store, onError])
  useLayoutEffect(() => {
    store.setTeamOrder(teamOrder)
  }, [store, teamOrder])
  useLayoutEffect(() => {
    store.setLang(lang)
  }, [store, lang])
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
 * Each personal version gets a new id and is stored as a new record, with
 * `ifMatch: null`. Versions made in other tabs and devices have their own
 * ids, and personal overlays resolve in `createdAt` order, so the later
 * change wins on a property both write, and changes to different
 * properties both apply. When the adapter answers with a conflict whose
 * `current` record has the version's id, an earlier attempt stored it
 * though its answer was lost: the version counts as saved, and the stored
 * overlay replaces this tab's copy. Any other conflict is reported and
 * saved again on the next flush, like any failed save. When a save stores
 * a version but fails with an error other than a conflict, and the version
 * is removed elsewhere before this tab loads it again or retries, the retry
 * stores it again.
 *
 * When the adapter implements `subscribe`, changes stored from another tab
 * or device show as they arrive: the surface loads again without going
 * back to `loading`. Personal versions this tab hasn't saved yet stay.
 * `localAdapter` does this for every root and tab of the same browser.
 *
 * @experimental
 */
export function PliantRoot(props: PliantRootProps) {
  return <PliantSurfaceRoot key={props.surface} {...props} />
}
