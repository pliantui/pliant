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

Install `ai` and the provider you use; the package doesn't depend on a provider. The handler accepts only JSON bodies up to 32 KB, caps the prompt at 500 characters, the answer at 8 tool calls and each model call at 15 seconds, but it has no rate limiting. Before exposing it, add authentication through `getUser` and your own per-user rate limits and token budgets. The ask's context comes from the client, so check overlays against your own manifests before saving them.

## Recordings

`recordings: { mode: "replay", directory }` serves answers from JSON files instead of calling the model, keyed by a hash of the model, the prompt and the tools; `mode: "record"` writes them. `pnpm --filter @pliantui/server record` records the orders demo asks into `recordings/`.

The committed recordings are stand-ins: they were made with `claude -p` (headless Claude Code), not the production API path, and each file says so with `standIn: true`. Replaying one logs a warning. They will be re-recorded through the API (`record --api` with `ANTHROPIC_API_KEY`); see [#24](https://github.com/pliantui/pliant/issues/24).
