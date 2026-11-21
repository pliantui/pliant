# @pliantui/server

Server handler, datasets and AI pipeline for Pliant.

Pliant is in early development. See https://github.com/pliantui/pliant.

## Ask handler (experimental)

`createPliantHandler` answers asks from the inspector: it turns the ask into ops with any [AI SDK](https://ai-sdk.dev) model, validates them with `@pliantui/core` and returns a session-layer overlay to preview. The request and response shapes may change in any release.

```ts
// app/api/pliant/route.ts
import { anthropic } from "@ai-sdk/anthropic"

import { createPliantHandler } from "@pliantui/server"

export const POST = createPliantHandler({
  model: anthropic("claude-haiku-5-5"),
  getUser: async (request) => (await auth(request))?.userId ?? null,
})
```

Install `ai` and the provider you use; the package doesn't depend on a provider. The handler uses only Web APIs, so it runs on Node.js and edge runtimes. `getUser` is required: return `null` to answer 401, or a fixed id such as `"anonymous"` to allow anonymous asks. The handler accepts only JSON bodies up to 32 KB, caps the prompt at 500 characters, the answer at 8 tool calls and each model call at 15 seconds, but it has no rate limiting. Before exposing it, add authentication through `getUser` and your own per-user rate limits and token budgets. The ask's context comes from the client, so check overlays against your own manifests before saving them.

## Storage handler (experimental)

`@pliantui/server/storage` exports `createStorageHandler`, a route handler that stores overlays through an `OverlayStore`, and `serverAdapter` from `@pliantui/react/server-adapter` is the storage adapter that calls it.

```ts
// app/api/pliant/storage/route.ts
import {
  createStorageHandler,
  memoryOverlayStore,
} from "@pliantui/server/storage"

const handler = createStorageHandler({
  store: memoryOverlayStore(),
  getUser: async (request) => {
    const session = await auth(request)
    return (
      session && {
        id: session.userId,
        org: session.orgId,
        teams: session.teamIds,
        roles: session.roles,
      }
    )
  },
  canPublish: (user, target) =>
    target.layer === "team" || user.roles.includes("admin"),
})

export { handler as GET, handler as PUT, handler as DELETE }
```

```ts
import { serverAdapter } from "@pliantui/react/server-adapter"

const storage = serverAdapter({ endpoint: "/api/pliant/storage" })
```

Pass `storage` to `PliantRoot`. Users read their own personal overlays and those of their `org` and of their `teams` in that org. Saving or removing a team or org overlay also needs `canPublish`, which gets the team or org with its org resolved; without it, nobody can. The handler validates every overlay and assigns every etag, version and timestamp. An overlay's `createdBy` comes from the client and isn't trusted; the store records the signed-in user as the author of each version. The handler has no quota or rate limit, so add your own before exposing it. A conflict answers 412 with the current record, and a removal stores a tombstone. `list` returns tombstones too, so an export includes removed overlays.

`memoryOverlayStore` is for tests and demos. On PostgreSQL with [Drizzle](https://orm.drizzle.team), use `drizzleOverlayStore` from `@pliantui/server/drizzle`. Install `drizzle-orm`, export the `pliantOverlays` and `pliantOverlayHistory` tables from your schema so your migrations create them, and pass your database:

```ts
// db/schema.ts
export { pliantOverlayHistory, pliantOverlays } from "@pliantui/server/drizzle"
```

```ts
import { drizzleOverlayStore } from "@pliantui/server/drizzle"

import { db } from "@/db"

const store = drizzleOverlayStore(db)
```

The database must connect to the primary and its driver must support transactions. Otherwise, implement `OverlayStore` over your database:

- one row per `(surface, layer, scope, id)`, where `scope` is the user id, `JSON.stringify([orgId, teamId])` or the org id;
- a `put` that writes only when the stored etag matches, in one statement, and writes the history row, with the author, in the same transaction;
- reads from the primary, not a replica, so users see their own saves.

## SQL queries (experimental)

`@pliantui/server/sql` exports `compileQuery`, which compiles one page of a dataset's rows for one user to a parameterized Postgres query: the fields the user may read, the rows in their scope that pass the table's filters, in the table's sort with ties broken by the row key.

```ts
import { authorizeDataset } from "@pliantui/server/data"
import { compileQuery } from "@pliantui/server/sql"

const grant = authorizeDataset(orders, user)
if (grant === null) {
  return new Response(null, { status: 403 })
}
const query = await request.json()
const { text, values } = compileQuery(orders, grant, query, {
  table: "orders",
  columns: { createdAt: "created_at", orgId: "org_id" },
  maxPageSize: 100,
})
const { rows } = await pool.query(text, values)
```

Each field is read from the column named by its id, or by `columns`; scope keys map the same way. Table and column names come only from these options and the dataset, and every value is a parameter. The query is parsed before use, and a query that names a field the user can't read, or sorts or filters in a way the field's capabilities don't allow, throws a `TypeError`. Every query is paged: a page has at most `maxPageSize` rows, whatever the query asks for. It defaults to 100 and can be set up to 1000. Store dates as `date` and datetimes as `timestamptz`; a day in a filter covers that day in the dataset's time zone. Text sorts in the column's collation, so the database's order can differ from the browser's for accents and case; give sort columns an ICU collation, such as `"und-x-icu"`, if the two must match.

## Recordings

`@pliantui/server/recordings` exports `recordingMiddleware`, an AI SDK middleware for development, tests and demos. In `replay` mode it serves answers from JSON files instead of calling the model, keyed by a hash of the model, the prompt and the tools; `record` mode writes them, including every ask.

```ts
import { wrapLanguageModel } from "ai"

import { recordingMiddleware } from "@pliantui/server/recordings"

const model = wrapLanguageModel({
  model: anthropic("claude-haiku-5-5"),
  middleware: recordingMiddleware({ mode: "replay", directory: "recordings" }),
})
```

To replay without a file system, such as on Cloudflare Workers, pass the parsed recording files instead of a directory: `recordingMiddleware({ mode: "replay", recordings })`. Replaying from `recordings` uses only Web APIs. Each recording is checked against the recording format when the middleware is created. Recording and replaying from a directory need Node.js.

The orders demo's recordings live in `apps/www`. `pnpm --filter www record` records them and writes `recordings/index.ts`, the module the demo imports them from. They are recorded through `claude -p` (headless Claude Code), not the Anthropic API, and each file says so with `standIn: true`.
