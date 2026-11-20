import type { StoredOverlay } from "@pliantui/contract"

/**
 * Thrown, or rejected with, by a storage adapter's `save` or `remove` when
 * `ifMatch` isn't the etag of the stored record. `current` is the stored
 * record, or `undefined` when there is none.
 *
 * Pliant recognizes a conflict by its shape: any `Error` named
 * `"StorageConflictError"` with a `current` property counts, so an adapter
 * can turn an HTTP 412 into one without importing this class.
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

export function isStorageConflictError(
  error: unknown
): error is StorageConflictError {
  return (
    error instanceof Error &&
    error.name === "StorageConflictError" &&
    "current" in error
  )
}
