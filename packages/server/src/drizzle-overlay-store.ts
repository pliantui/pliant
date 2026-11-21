import {
  and,
  asc,
  eq,
  inArray,
  or,
  sql,
  type TablesRelationalConfig,
} from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import { pliantOverlayHistory, pliantOverlays } from "./drizzle-overlay-tables"
import type { OverlayKey, OverlayQuery, OverlayStore } from "./overlay-store"

type Table = typeof pliantOverlays | typeof pliantOverlayHistory

function byKey(table: Table, { surface, layer, scope, id }: OverlayKey) {
  return and(
    eq(table.surface, surface),
    eq(table.layer, layer),
    eq(table.scope, scope),
    eq(table.id, id)
  )
}

function byQuery(table: Table, { scopes, surfaces, id }: OverlayQuery) {
  return and(
    or(
      ...scopes.map(({ layer, scope }) =>
        and(eq(table.layer, layer), eq(table.scope, scope))
      )
    ),
    surfaces && inArray(table.surface, surfaces),
    id === undefined ? undefined : eq(table.id, id)
  )
}

/**
 * Keeps stored overlays in PostgreSQL through Drizzle, in the
 * `pliantOverlays` and `pliantOverlayHistory` tables, which must be in your
 * migrations. Pass a database connected to the primary, through a driver
 * that supports transactions: each `put` is a conditional write and its
 * history row, in one transaction.
 *
 * ```ts
 * import { drizzle } from "drizzle-orm/node-postgres"
 *
 * import { drizzleOverlayStore } from "@pliantui/server/drizzle"
 *
 * const store = drizzleOverlayStore(drizzle(process.env.DATABASE_URL))
 * ```
 *
 * @experimental
 */
export function drizzleOverlayStore<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: PgDatabase<TQueryResult, TFullSchema, TSchema>): OverlayStore {
  return {
    async get(key) {
      const [row] = await db
        .select({ record: pliantOverlays.record })
        .from(pliantOverlays)
        .where(byKey(pliantOverlays, key))
      return row?.record
    },

    put(key, record, ifMatch, { by }) {
      const { surface, layer, scope, id } = key
      return db.transaction(async (tx) => {
        const written =
          ifMatch === null
            ? await tx
                .insert(pliantOverlays)
                .values({
                  surface,
                  layer,
                  scope,
                  id,
                  etag: record.etag,
                  record,
                })
                .onConflictDoNothing()
                .returning({ id: pliantOverlays.id })
            : await tx
                .update(pliantOverlays)
                .set({ etag: record.etag, record })
                .where(
                  and(
                    byKey(pliantOverlays, key),
                    eq(pliantOverlays.etag, ifMatch)
                  )
                )
                .returning({ id: pliantOverlays.id })
        if (written.length === 0) {
          return false
        }
        await tx.insert(pliantOverlayHistory).values({
          surface,
          layer,
          scope,
          id,
          version: record.version,
          record,
          by,
          updatedAt: record.updatedAt,
        })
        return true
      })
    },

    async list(query) {
      if (query.scopes.length === 0) {
        return []
      }
      const rows = await db
        .select({ record: pliantOverlays.record })
        .from(pliantOverlays)
        .where(byQuery(pliantOverlays, query))
      return rows.map((row) => row.record)
    },

    async history(query) {
      if (query.scopes.length === 0) {
        return []
      }
      return db
        .select({
          record: pliantOverlayHistory.record,
          by: pliantOverlayHistory.by,
        })
        .from(pliantOverlayHistory)
        .where(byQuery(pliantOverlayHistory, query))
        .orderBy(
          asc(pliantOverlayHistory.updatedAt),
          asc(pliantOverlayHistory.version),
          // Byte order, so ids sort the same under every database collation.
          sql`${pliantOverlayHistory.id} collate "C"`
        )
    },
  }
}
