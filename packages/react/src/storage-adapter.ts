import type { Overlay } from "@pliantui/contract"

/**
 * The saved overlays of one surface, by layer, as stored. Each entry is read
 * with core's `loadOverlay`; one that doesn't load is kept but not applied.
 *
 * @experimental
 */
export interface StoredLayers {
  readonly org?: readonly unknown[] | undefined
  readonly team?: readonly unknown[] | undefined
  readonly personal?: readonly unknown[] | undefined
}

/**
 * Where `PliantRoot` loads a surface's layers from and saves personal
 * overlays to. The store calls it only in the browser, after mount.
 *
 * A save that throws or rejects is reported to `PliantRoot`'s `onError`,
 * and the version is saved again on the next flush. Saves also run on
 * `pagehide`, while the page unloads, so an adapter that sends them over the
 * network must use `fetch` with `keepalive: true` or `navigator.sendBeacon`.
 *
 * @experimental
 */
export interface StorageAdapter {
  /**
   * Loads the saved overlays for a surface. A rejection sets the status to
   * `error` (see `usePliantStatus`).
   */
  load(surface: string): StoredLayers | Promise<StoredLayers>
  /**
   * Saves one personal overlay version, replacing a saved overlay with the
   * same id. Throws or rejects when it can't.
   */
  save(surface: string, overlay: Overlay): void | Promise<void>
}
