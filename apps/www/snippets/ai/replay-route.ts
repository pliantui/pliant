// #region replay
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"

import { createPliantHandler } from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

const model = wrapLanguageModel({
  model: anthropic("claude-haiku-5-5"),
  middleware: recordingMiddleware({
    mode: "replay",
    directory: "recordings",
  }),
})

export const POST = createPliantHandler({
  model,
  getUser: () => "demo",
})
// #endregion replay
