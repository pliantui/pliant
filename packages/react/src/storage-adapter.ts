import type { Overlay, StoredOverlay } from "@pliantui/contract"

/**
 * The stored overlays of one surface, by layer, as records with their etag
 * and version. Each overlay is read with core's `loadOverlay`; one that
 * doesn't load isn't applied.
 *
 * @experimental
 */
export interface StoredLayers {
  readonly org?: readonly StoredOverlay[] | undefined
  readonly team?: readonly StoredOverlay[] | undefined
  readonly personal?: readonly StoredOverlay[] | undefined
}

/**
 * Where `PliantRoot` loads a surface's layers from and saves overlays to.
 * The store calls it only in the browser, after mount.
 *
 * Writes are conditional. `save` and `remove` take the etag of the record
 * they replace, and must throw or reject with a `StorageConflictError`
 * when the stored record has another one, so that two tabs or devices
 * don't overwrite each other's changes unseen. Every successful save must
 * give the record an etag it has never had before, even when it stores the
 * same overlay again. `version` starts at 1 when a record is created, and
 * each save of that record increases it; an overlay removed and stored
 * again starts at 1.
 *
 * `PliantRoot` stores each personal version as one record, with
 * `ifMatch: null`, and calls only `load`, `save` and `subscribe`. When a
 * save stores a version but fails with an error other than a conflict, and
 * the version is removed elsewhere before this tab loads it again or
 * retries, the retry stores it again.
 *
 * Saves also run on `pagehide`, while the page unloads, so an adapter that
 * sends them over the network must use `fetch` with `keepalive: true` or
 * `navigator.sendBeacon`.
 *
 * @experimental
 */
export interface StorageAdapter {
  /**
   * Loads the stored overlays of a surface, in every layer the user can
   * read, with the `@app` overlays. A rejection sets the status to `error`
   * (see `usePliantStatus`).
   *
   * A load must see every save that finished before it started: read from
   * the primary database, not a replica, and fetch with
   * `cache: "no-store"`. A load that misses a finished save hides that
   * version until the next load that includes it.
   */
  load(surface: string): StoredLayers | Promise<StoredLayers>
  /**
   * Stores an overlay in the layer and scope it names, replacing the record
   * with the same id, and returns the new record. `ifMatch` is the etag of
   * the record it replaces, or `null` to store a new overlay. Throws or
   * rejects with a `StorageConflictError` when that doesn't hold, and with
   * any other error when it can't save.
   */
  save(
    surface: string,
    overlay: Overlay,
    options: { readonly ifMatch: string | null }
  ): StoredOverlay | Promise<StoredOverlay>
  /**
   * Removes the overlay with this id when its record's etag is `ifMatch`,
   * and throws a `StorageConflictError` when it isn't. Removing an overlay
   * that isn't stored does nothing. It lets an app delete stored overlays,
   * such as when a user resets their changes or asks for their data to be
   * erased.
   */
  remove?(
    surface: string,
    id: string,
    options: { readonly ifMatch: string }
  ): void | Promise<void>
  /**
   * Lists the stored records of a layer the user can read, on every
   * surface. It lets an app find all of a user's stored overlays, such as
   * to export them.
   */
  list?(
    layer: "org" | "team" | "personal"
  ): readonly StoredOverlay[] | Promise<readonly StoredOverlay[]>
  /**
   * Calls `onChange` when the stored overlays of a surface change from
   * somewhere else, such as another tab or device, and returns a function
   * that stops it. `PliantRoot` then loads the surface again, so calling it
   * for this tab's own saves too, or while a load runs, is harmless: the
   * latest load wins.
   */
  subscribe?(surface: string, onChange: () => void): () => void
}
