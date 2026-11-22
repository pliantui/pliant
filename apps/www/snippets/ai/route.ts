// #region route
import { anthropic } from "@ai-sdk/anthropic"

import { createPliantHandler } from "@pliantui/server"

import { getSessionUser } from "./session"

export const POST = createPliantHandler({
  // Any AI SDK language model works here.
  model: anthropic("claude-haiku-5-5"),
  // Return null to answer 401 to anyone who isn't signed in.
  getUser: (request) => getSessionUser(request)?.id ?? null,
})
// #endregion route
