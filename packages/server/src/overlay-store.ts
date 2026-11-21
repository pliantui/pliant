import type { StoredOverlay } from "@pliantui/contract"

/**
 * One group of stored overlays: a user's personal overlays, one team's, or
 * one org's. `scope` depends on the layer:
 *
 * - `personal`: the user's id;
 * - `team`: `JSON.stringify([orgId, teamId])`, so a team id only needs to
 *   be unique within its org;
 * - `org`: the org's id.
 *
 * @experimental
 */
export interface OverlayScope {
  readonly layer: "org" | "team" | "personal"
  readonly scope: string
}

/**
 * The key of one stored overlay. A store keeps at most one current record
 * per key, which is a unique key in a SQL table. A tombstone blocks saving
 * under its own key only: the same overlay id in another layer, scope or
 * surface is another record.
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
 * A record as `history` returns it, with the id of the user who stored it.
 *
 * @experimental
 */
export interface OverlayVersion {
  readonly record: StoredOverlay
  readonly by: string
}

/**
 * Where `createStorageHandler` keeps stored overlays. The handler checks
 * permissions and assigns every etag, version and timestamp; a store only
 * keeps records, and must make `put` atomic.
 *
 * A record with `deletedAt` is a tombstone. A store keeps it like any other
 * record, and returns it from `get`, `list` and `history`.
 *
 * `get` and `list` must read from the primary database, not a replica, so
 * that a client sees its own writes and conflicts are checked against the
 * latest record.
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
   * `by` is the id of the user who stores it. A store with `history` also
   * keeps every record it stores, with `by`, written in the same
   * transaction as the record.
   */
  put(
    key: OverlayKey,
    record: StoredOverlay,
    ifMatch: string | null,
    options: { readonly by: string }
  ): Promise<boolean>
  /** The current record of each matching key, tombstones included. */
  list(query: OverlayQuery): Promise<readonly StoredOverlay[]>
  /**
   * The matching records the store keeps, earlier versions and tombstones
   * included, each with the user who stored it, ordered by the record's
   * `updatedAt`, then `version`, then overlay id. Without it, history holds
   * only the current record of each overlay, from `list`.
   */
  history?(query: OverlayQuery): Promise<readonly OverlayVersion[]>
}
