import type { StoredOverlay } from "@pliantui/contract"

/**
 * Thrown, or rejected with, by a storage adapter's `save` or `remove` when
 * `ifMatch` isn't the etag of the stored record. `current` is the stored
 * record, or `undefined` when there is none.
 *
 * @experimental
 */
export class StorageConflictError extends Error {
  override readonly name = "StorageConflictError"
  readonly current: StoredOverlay | undefined

  constructor(current: StoredOverlay | undefined) {
    super("The stored overlay doesn't match ifMatch")
    this.current = current
  }
}
