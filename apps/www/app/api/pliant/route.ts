import { join } from "node:path"
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"

import { createPliantHandler } from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

// The demo replays the committed recordings of the orders asks, so it never
// calls the model. `next start` and `next dev` run from apps/www.
const handler = createPliantHandler({
  model: wrapLanguageModel({
    model: anthropic("claude-haiku-5-5"),
    middleware: recordingMiddleware({
      mode: "replay",
      directory: join(process.cwd(), "../../packages/server/recordings"),
    }),
  }),
  getUser: () => "anonymous",
})

function isEnabled() {
  // Read per request, not at build time. The ask endpoint has no rate limits
  // yet, so it stays off unless the deployment opts in.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return process.env["PLIANT_ASK_ENABLED"] === "1"
}

export async function POST(request: Request) {
  if (!isEnabled()) {
    return Response.json(
      { status: "error", message: "Asking is turned off on this site." },
      { status: 404 }
    )
  }
  return handler(request)
}
