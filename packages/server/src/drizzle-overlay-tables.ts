import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import type { StoredOverlay } from "@pliantui/contract"

import type { OverlayScope } from "./overlay-store"

function keyColumns() {
  return {
    surface: text("surface").notNull(),
    layer: text("layer").$type<OverlayScope["layer"]>().notNull(),
    scope: text("scope").notNull(),
    id: text("id").notNull(),
  }
}

/**
 * The current record of each stored overlay, one row per
 * `(surface, layer, scope, id)`. Add it to the schema your migrations are
 * generated from.
 *
 * @experimental
 */
export const pliantOverlays = pgTable(
  "pliant_overlays",
  {
    ...keyColumns(),
    etag: text("etag").notNull(),
    record: jsonb("record").$type<StoredOverlay>().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.surface, table.layer, table.scope, table.id],
    }),
    index("pliant_overlays_scope").on(table.layer, table.scope, table.surface),
  ]
)

/**
 * Every record stored in `pliantOverlays`, with the id of the user who
 * stored it. Add it to the schema your migrations are generated from.
 *
 * @experimental
 */
export const pliantOverlayHistory = pgTable(
  "pliant_overlay_history",
  {
    ...keyColumns(),
    version: integer("version").notNull(),
    record: jsonb("record").$type<StoredOverlay>().notNull(),
    by: text("by").notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.surface,
        table.layer,
        table.scope,
        table.id,
        table.version,
      ],
    }),
    index("pliant_overlay_history_scope").on(
      table.layer,
      table.scope,
      table.surface
    ),
  ]
)
