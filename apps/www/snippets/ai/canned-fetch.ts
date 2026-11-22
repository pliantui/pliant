// #region fetch
import { askRequestSchema, type AskResponse } from "@pliantui/server"

const answers: Record<string, AskResponse> = {
  "make it compact": {
    status: "clarify",
    question: "Do you mean fewer columns, or smaller rows?",
  },
}

export const cannedFetch: typeof fetch = (_input, init) => {
  const body = typeof init?.body === "string" ? init.body : "{}"
  const ask = askRequestSchema.parse(JSON.parse(body))
  return Promise.resolve(
    Response.json(
      answers[ask.prompt] ?? {
        status: "error",
        message: "This demo answers only its suggested asks.",
      }
    )
  )
}
// #endregion fetch
