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
 * @experimental
 */
export interface StorageAdapter {
  /** Loads the saved overlays for a surface. */
  load(surface: string): StoredLayers | Promise<StoredLayers>
  /**
   * Saves one personal overlay version, replacing a saved overlay with the
   * same id.
   */
  save(surface: string, overlay: Overlay): void | Promise<void>
}
