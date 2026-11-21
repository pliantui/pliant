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

`@pliantui/server/storage` exports `createStorageHandler`, a route handler that stores overlays in your own database, and `serverAdapter` from `@pliantui/react/server-adapter` is the storage adapter that calls it.

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
  canPublish: (user, layer) => layer === "team" || user.roles.includes("admin"),
})

export { handler as GET, handler as PUT, handler as DELETE }
```

```tsx
<PliantRoot storage={serverAdapter({ endpoint: "/api/pliant/storage" })}>
```

Each user reads their own personal overlays, the overlays of the teams in `teams` and of their `org`. Saving or removing a team or org overlay also needs `canPublish` to return `true`; without `canPublish`, nobody can. The handler validates every overlay against the contract and assigns every etag, version and timestamp itself; a save sends `If-Match` or `If-None-Match: *`, and a conflict answers 412 with the current record. Removing an overlay stores a tombstone, which blocks saving that id again.

`memoryOverlayStore` keeps overlays in memory, for tests and demos. In production, implement `OverlayStore` over your database: one row per `(surface, layer, scope, id)`, a `put` that writes only when the stored etag matches in a single statement, and a history of every record written. Tombstones are rows with `deletedAt`; purge them after 30 days or more, as the `@pliantui/contract` README describes.

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
