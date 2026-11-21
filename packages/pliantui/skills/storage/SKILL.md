---
name: storage
description: Choose where Pliant stores users' changes and set up self-hosted server storage so team and org defaults and users' personal changes follow them across browsers. Use when asked to store overlays or customizations in a database, share defaults with a team or org, use serverAdapter, createStorageHandler or OverlayStore, or render saved layers on the server.
---

# Where Pliant stores changes

Pliant keeps users' changes as overlays in four layers: `org`, `team`, `personal` and `session`. A storage adapter loads the org, team and personal overlays of a page, saves personal ones, and removes them when a user resets a table with the toolbar's Reset. The session layer is per browser tab and is never stored. This skill covers the adapters and the self-hosted server storage. Adding Pliant to a page is the `setup` skill.

## Pick one

- **Browser, `localAdapter`.** Nothing to set up: pass `storage={localAdapter}`, imported from `@pliantui/react/local`. Personal changes are kept in the browser's `localStorage`, per browser and per origin. There are no team or org overlays. Right for a demo, an internal tool, or when per-browser is enough.
- **Server storage.** Your app serves a route with `createStorageHandler`, backed by a database table you own, and the browser uses `serverAdapter`. Personal changes follow the user across browsers, and team and org defaults become possible. The rest of this skill is about it.

If the user hasn't said, use `localAdapter` and mention the other. Server storage needs sign-in: the handler can't work without knowing who the user is.

## 1. Implement an `OverlayStore`

The store keeps records and nothing else: the handler checks permissions and assigns every etag, version and timestamp. `memoryOverlayStore()` from `@pliantui/server/storage` is for tests and demos only, because it forgets everything on restart and isn't shared between servers. In production, write a store over the app's database.

If the app uses [Drizzle](https://orm.drizzle.team) with PostgreSQL, don't write a store: use `drizzleOverlayStore` from `@pliantui/server/drizzle`. Export its `pliantOverlays` and `pliantOverlayHistory` tables from the schema the app's migrations are generated from, generate and apply the migration, and pass the app's database:

```ts
// db/schema.ts
export { pliantOverlayHistory, pliantOverlays } from "@pliantui/server/drizzle"
```

```ts
// lib/overlay-store.ts
import { drizzleOverlayStore } from "@pliantui/server/drizzle"

import { db } from "@/db" // the app's Drizzle database

export const overlayStore = drizzleOverlayStore(db)
```

It keeps every rule below. Pass a database connected to the primary, through a driver with transactions, such as `node-postgres`, `postgres-js` or PGlite. The rest of this step is for writing a store over another database or client.

A stored overlay is keyed by `surface`, `layer`, `scope` and `id`. `scope` depends on the layer:

- `personal`: the user's id;
- `team`: `JSON.stringify([orgId, teamId])`, so a team id only needs to be unique within its org;
- `org`: the org's id.

Rules the store must keep:

- One current row per `(surface, layer, scope, id)`, which is a unique key. Removed overlays stay as rows with `deletedAt` set (tombstones). Return them from `get`, `list` and `history`; the handler hides them from users.
- `put` stores the record only when the current etag is `ifMatch` (or, when `ifMatch` is `null`, only when there is no row), and returns whether it did. The check and the write are one statement judged by the rows written: `INSERT … ON CONFLICT DO NOTHING` or `UPDATE … WHERE etag = $ifMatch`. A read followed by a write is a race.
- A store with `history` writes every record it stores, with `by` (the user's id), in the same transaction as the record.
- `get`, `list` and `history` read from the primary database, never a replica, so users see their own saves.
- `list` and `history` return nothing for a query with no `scopes`, and must not build invalid SQL for it.

This Postgres sketch needs two tables. The `on conflict do nothing` create below relies on the primary key of `pliant_overlays`: without it, two creates of the same overlay would both succeed.

```sql
create table pliant_overlays (
  surface text not null,
  layer text not null,
  scope text not null,
  id text not null,
  etag text not null,
  record jsonb not null,
  primary key (surface, layer, scope, id)
);
create index pliant_overlays_scope on pliant_overlays (layer, scope, surface);

create table pliant_overlay_history (
  surface text not null,
  layer text not null,
  scope text not null,
  id text not null,
  version int not null,
  record jsonb not null,
  by text,
  updated_at timestamptz not null,
  primary key (surface, layer, scope, id, version)
);
create index pliant_overlay_history_scope on pliant_overlay_history (layer, scope, surface);
```

```ts
import type { StoredOverlay } from "@pliantui/react"
import type {
  OverlayKey,
  OverlayQuery,
  OverlayStore,
} from "@pliantui/server/storage"

import { db } from "@/lib/db" // your database client

function where(query: OverlayQuery, params: unknown[]) {
  const push = (value: unknown) => `$${String(params.push(value))}`
  const conditions = [
    `(${query.scopes
      .map(
        ({ layer, scope }) =>
          `(layer = ${push(layer)} and scope = ${push(scope)})`
      )
      .join(" or ")})`,
  ]
  if (query.surfaces) {
    conditions.push(`surface = any(${push(query.surfaces)})`)
  }
  if (query.id) {
    conditions.push(`id = ${push(query.id)}`)
  }
  return conditions.join(" and ")
}

export const overlayStore: OverlayStore = {
  async get({ surface, layer, scope, id }: OverlayKey) {
    const { rows } = await db.query<{ record: StoredOverlay }>(
      "select record from pliant_overlays where surface = $1 and layer = $2 and scope = $3 and id = $4",
      [surface, layer, scope, id]
    )
    return rows[0]?.record
  },

  async put({ surface, layer, scope, id }, record, ifMatch, { by }) {
    return db.transaction(async (tx) => {
      const params = [surface, layer, scope, id, record.etag, record]
      const { rowCount } =
        ifMatch === null
          ? await tx.query(
              "insert into pliant_overlays (surface, layer, scope, id, etag, record) values ($1, $2, $3, $4, $5, $6) on conflict do nothing",
              params
            )
          : await tx.query(
              "update pliant_overlays set etag = $5, record = $6 where surface = $1 and layer = $2 and scope = $3 and id = $4 and etag = $7",
              [...params, ifMatch]
            )
      if (rowCount === 0) {
        return false
      }
      await tx.query(
        "insert into pliant_overlay_history (surface, layer, scope, id, version, record, by, updated_at) values ($1, $2, $3, $4, $7, $6, $8, $9)",
        [...params, record.version, by, record.updatedAt]
      )
      return true
    })
  },

  async list(query) {
    if (query.scopes.length === 0) {
      return []
    }
    const params: unknown[] = []
    const { rows } = await db.query<{ record: StoredOverlay }>(
      `select record from pliant_overlays where ${where(query, params)}`,
      params
    )
    return rows.map((row) => row.record)
  },

  async history(query) {
    if (query.scopes.length === 0) {
      return []
    }
    const params: unknown[] = []
    const { rows } = await db.query<{ record: StoredOverlay; by: string }>(
      `select record, by from pliant_overlay_history where ${where(query, params)} order by updated_at, version, id`,
      params
    )
    return rows
  },
}
```

This is a Postgres sketch: adapt the SQL, the column types and the `db` client to the project. `history` returns each row as `{ record, by }`, ordered by the time each version was stored.

## 2. Serve the handler

Turn the session into a Pliant user in one function, and use it everywhere: in the handler's `getUser` and in the server render in step 4. The scopes a user reads are derived from it too, mirroring the handler: the personal scope always, and team and org scopes only when the user has an org.

```ts
// lib/pliant-user.ts
import type { OverlayScope, StorageUser } from "@pliantui/server/storage"

export function pliantUserOf(session: {
  userId: string
  orgId?: string
  teamIds: string[]
  roles: string[]
}) {
  return {
    id: session.userId,
    org: session.orgId,
    teams: session.teamIds,
    roles: session.roles,
  }
}

export function readableScopes(user: StorageUser): OverlayScope[] {
  const scopes: OverlayScope[] = [{ layer: "personal", scope: user.id }]
  if (user.org !== undefined) {
    for (const team of user.teams ?? []) {
      scopes.push({ layer: "team", scope: JSON.stringify([user.org, team]) })
    }
    scopes.push({ layer: "org", scope: user.org })
  }
  return scopes
}
```

```ts
// app/api/pliant/storage/route.ts
import { createStorageHandler } from "@pliantui/server/storage"

import { auth } from "@/lib/auth" // your session lookup
import { overlayStore } from "@/lib/overlay-store"
import { pliantUserOf } from "@/lib/pliant-user"

const handler = createStorageHandler({
  store: overlayStore,
  getUser: async (request) => {
    const session = await auth(request)
    if (!session) {
      return null
    }
    return pliantUserOf(session)
  },
  // The app's policy: only admins publish defaults, to teams and to the org.
  canPublish: (user) => user.roles.includes("admin"),
  onError: (error) => console.error("Pliant storage", error),
})

export { handler as GET, handler as PUT, handler as DELETE }
```

- `getUser` returns the signed-in user, or `null` for a 401. Return `null` itself: the handler checks for `null`, and `undefined` makes it answer 500. `org` is the user's org and `teams` are the ids of the teams of that org they belong to. Add whatever `canPublish` needs, such as `roles`.
- Users read their own personal overlays, those of the teams they belong to, and their org's. Reading is by membership only. A user with no org reads no team or org overlays.
- `canPublish(user, target)` decides who may save or remove team and org overlays. `target` is `{ layer: "team", org, team }` or `{ layer: "org", org }`. Without `canPublish`, nobody can publish: the handler answers 403. It is asked only about the user's own org and teams they belong to. Who may publish is the app's policy, so ask the user: the example lets only admins do it for both layers, and a rule such as "any team member may publish team defaults" is a choice to make on purpose, because it changes what every other member of the team sees.
- `onError` receives the errors the handler hides behind a 500, so you can log them.
- The handler accepts GET, PUT and DELETE only, and bodies up to 256 KB that nest no deeper than 64 levels. It rejects session overlays, and answers 412 with the current record on a conflict.
- It has no quota or rate limit. Add your own before exposing it.
- Don't enable CORS with credentials on this route. Saves and removals need a JSON content type and an `If-Match` header, which make a cross-origin request preflight, and the route doesn't answer preflights. That is what keeps other sites from sending cookie-authenticated PUT and DELETE requests.

A personal overlay is always stored under the signed-in user's id. The `createdBy` an overlay carries comes from the client and isn't trusted: the store records the signed-in user as the author of each version.

## 3. Use it in `PliantRoot`

`PliantRoot` reads `storage` once, and an object of functions can't pass from a Server Component. Make the adapter in a client file:

```tsx
"use client"

import type { ReactNode } from "react"

import { PliantRoot, type StoredLayers } from "@pliantui/react"
import { serverAdapter } from "@pliantui/react/server-adapter"

const storage = serverAdapter({ endpoint: "/api/pliant/storage" })

export function OrdersRoot({
  layers,
  children,
}: {
  layers?: StoredLayers
  children: ReactNode
}) {
  return (
    <PliantRoot surface="/orders" storage={storage} layers={layers}>
      {children}
    </PliantRoot>
  )
}
```

Use `OrdersRoot` in the page in place of `PliantRoot`. `serverAdapter` sends the browser's cookies to the same origin. To add an authorization header, or call another origin, pass `fetch`. It has no `subscribe`, so a page reloads its layers when it mounts, not when another tab saves. To react to other tabs, add a `subscribe` that listens to your own channel.

## 4. Render saved layers on the server (optional)

Without `layers`, the server HTML shows the page as you wrote it and the user's changes apply after hydration. Pass `layers`, as `storage.load` returns them, and the server render and hydration apply them:

```tsx
// app/orders/page.tsx
import { OrdersRoot } from "@/components/orders-root"
import { currentSession } from "@/lib/auth" // your session lookup, without a request
import { overlayStore } from "@/lib/overlay-store"
import { pliantUserOf, readableScopes } from "@/lib/pliant-user"

export default async function Page() {
  const session = await currentSession()
  const user = session && pliantUserOf(session)
  const records = user
    ? await overlayStore.list({
        scopes: readableScopes(user),
        surfaces: ["/orders", "@app"],
      })
    : []
  const live = records.filter((record) => !record.deletedAt)
  const layers = {
    org: live.filter((record) => record.overlay.layer === "org"),
    team: live.filter((record) => record.overlay.layer === "team"),
    personal: live.filter((record) => record.overlay.layer === "personal"),
  }

  return (
    <OrdersRoot layers={layers}>
      <h1>Orders</h1>
    </OrdersRoot>
  )
}
```

- Use the same session-to-user function and scopes as the handler, the same store, and tombstones left out. Storage stays the source of truth: when its reload doesn't return a personal overlay, Pliant treats that overlay as removed and stops applying it.
- The server HTML shows reordering, hiding and layout. Ops that need their container mounted, such as `insert`, `wrap` and `move` into another node, show the base layout in the server HTML and apply when the page hydrates. There is no skeleton for them.
- Loading per user makes the route dynamic. Under Next.js `cacheComponents`, load inside a `<Suspense>` boundary.
- `PliantPrePaint` reads only what `localAdapter` stored in this browser. With server storage it hides nothing, except for personal changes an earlier `localAdapter` left in that browser. Rendering `layers` is what avoids the flash of the original layout.

## 5. Verify

1. Run the project's typecheck and `next build`.
2. Signed out, `GET /api/pliant/storage?surface=%2Forders` answers 401. Signed in, it answers 200 with `org`, `team` and `personal` arrays.
3. In the browser, make a change, such as hiding a column, and reload: it applies. Open the page in another browser as the same user: it applies there too, which `localAdapter` can't do.
4. Look in the table: a row for the change exists with the user's id as `scope`, and a history row with `by` set.
5. As a user `canPublish` rejects, saving a team or org overlay answers 403. As one it allows, it saves, and the team's other members see it as a default.
6. Make the same change from two tabs with a stale etag, or call `PUT` twice with `If-None-Match: *` for the same id: the second answers 412.

## Common mistakes

- Using `memoryOverlayStore` in production.
- A `getUser` that always returns a user, or no authentication on the route. Anyone who reaches the route can then read and write that user's changes.
- Building the adapter in a Server Component and passing it to `PliantRoot`.
- A `put` that reads the etag and then writes, instead of one conditional statement. Two tabs then overwrite each other.
- Writing the history row in a separate transaction, or not at all, so the audit trail disagrees with the table.
- Reading from a replica. Users then lose their own latest change until the replica catches up.
- The wrong team `scope`: it is `JSON.stringify([orgId, teamId])`, not the bare team id.
- Expecting `canPublish` to be consulted for reading, or to be open by default: it only guards saving and removing team and org overlays, and without it nobody can publish.
- Passing `layers` that are staler than what storage returns, or that include tombstones or another user's overlays.
- Deleting tombstones right away. Keep them at least 30 days so a retried save can't bring a removed overlay back.
- Expecting the session layer to be stored. Pagination, filters (without `persistFilters`) and unsaved previews stay in the tab.

## Docs

- [Layers](https://pliantui.dev/docs/concepts/layers): how org, team, personal and session changes stack.
- [Guardrails](https://pliantui.dev/docs/concepts/guardrails): what is never saved, and why hidden is not secret.
- [Core concepts](https://pliantui.dev/docs/concepts): surfaces, addresses, regions and overlays.
