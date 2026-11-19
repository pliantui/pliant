import { join } from "node:path"
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"
import * as z from "zod"

import { createPliantHandler } from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

import { askTargets } from "@/app/(examples)/examples/orders/ask-targets"

// The demo replays the committed recordings of the orders asks, so it never
// calls the model. `next start` and `next dev` run from apps/www.
const model = wrapLanguageModel({
  model: anthropic("claude-haiku-5-5"),
  middleware: recordingMiddleware({
    mode: "replay",
    directory: join(process.cwd(), "../../packages/server/recordings"),
  }),
})

const askSchema = z.looseObject({ target: z.string() })

function isEnabled() {
  // Read per request, not at build time. The ask endpoint has no rate limits
  // yet, so it stays off unless the deployment opts in.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  return process.env["PLIANT_ASK_ENABLED"] === "1"
}

// Replays are keyed by the exact ask, so any other ask has no recording. It
// gets the asks that have one, instead of the missing recording's key.
async function recordedAsks(request: Request) {
  const ask = askSchema.safeParse(await request.json().catch(() => undefined))
  const target = askTargets.find(({ id }) => id === ask.data?.target)
  return Response.json({
    status: "unavailable",
    reason: target
      ? `This demo only answers its recorded asks. Try: ${target.suggestions.join("; ")}.`
      : "This demo only answers its recorded asks.",
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
  const copy = request.clone()
  const response = await handler(request)
  const missing = errors.some(
    (error) => error instanceof Error && error.name === "MissingRecordingError"
  )
  return missing ? recordedAsks(copy) : response
}
