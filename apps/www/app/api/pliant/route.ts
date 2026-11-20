import { join } from "node:path"
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"

import { createPliantHandler } from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

// The demo replays the committed recordings of the orders asks, so it never
// calls the model. `next start` and `next dev` run from apps/www.
const model = wrapLanguageModel({
  model: anthropic("claude-haiku-5-5"),
  middleware: recordingMiddleware({
    mode: "replay",
    directory: join(process.cwd(), "recordings"),
  }),
})

function isEnabled() {
  // Read per request, not at build time. The ask endpoint has no rate
  // limits, so it stays off unless the deployment opts in.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return process.env["PLIANT_ASK_ENABLED"] === "1"
}

// Replays are keyed by the exact ask, so any other ask has no recording. It
// gets pointed at the recorded asks instead of the missing recording's key.
function unrecorded() {
  return Response.json({
    status: "unavailable",
    reason:
      "This demo only answers its recorded asks. Try one of the suggestions.",
  })
}

export async function POST(request: Request) {
  if (!isEnabled()) {
    return Response.json(
      { status: "error", message: "Asking is turned off on this site." },
      { status: 404 }
    )
  }
  const errors: unknown[] = []
  const handler = createPliantHandler({
    model,
    getUser: () => "anonymous",
    onError: (error) => {
      errors.push(error)
    },
  })
  const response = await handler(request)
  const missing = errors.some(
    (error) => error instanceof Error && error.name === "MissingRecordingError"
  )
  return missing ? unrecorded() : response
}
