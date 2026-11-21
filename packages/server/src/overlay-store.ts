import type { StoredOverlay } from "@pliantui/contract"

/**
 * One group of stored overlays: a user's personal overlays, one team's, or
 * one org's. `scope` is the user id, the team id or the org id.
 *
 * @experimental
 */
export interface OverlayScope {
  readonly layer: "org" | "team" | "personal"
  readonly scope: string
}

/**
 * The key of one stored overlay. A store keeps at most one current record
 * per key, which is a unique key in a SQL table.
 *
 * @experimental
 */
export interface OverlayKey extends OverlayScope {
  readonly surface: string
  readonly id: string
}

/**
 * Which records `list` and `history` return: those in any of `scopes`, on
 * any of `surfaces` (every surface when it is left out), with overlay id
 * `id` when it is given.
 *
 * @experimental
 */
export interface OverlayQuery {
  readonly scopes: readonly OverlayScope[]
  readonly surfaces?: readonly string[] | undefined
  readonly id?: string | undefined
}

/**
 * Where `createStorageHandler` keeps stored overlays. The handler checks
 * permissions and assigns every etag, version and timestamp; a store only
 * keeps records, and must make `put` atomic.
 *
 * A record with `deletedAt` is a tombstone. A store keeps it like any other
 * record, and returns it from `get`, `list` and `history`.
 *
 * @experimental
 */
export interface OverlayStore {
  /** The current record under `key`, tombstones included. */
  get(key: OverlayKey): Promise<StoredOverlay | undefined>
  /**
   * Stores `record` under `key` only when the current record's etag is
   * `ifMatch`, or, when `ifMatch` is `null`, only when there is no record.
   * Resolves `true` when it stored the record and `false` when the
   * condition didn't hold. The check and the write must be one atomic step,
   * such as an `INSERT … ON CONFLICT DO NOTHING` or an
   * `UPDATE … WHERE etag = $ifMatch`, judged by the number of rows written.
   * Every stored record is also kept for `history`.
   */
  put(
    key: OverlayKey,
    record: StoredOverlay,
    ifMatch: string | null
  ): Promise<boolean>
  /** The current record of each matching key, tombstones included. */
  list(query: OverlayQuery): Promise<readonly StoredOverlay[]>
  /**
   * The matching records the store keeps, earlier versions and tombstones
   * included, ordered by `updatedAt`, then by `version`.
   */
  history(query: OverlayQuery): Promise<readonly StoredOverlay[]>
}
