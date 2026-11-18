import { readFile } from "node:fs/promises"
import { anthropic } from "@ai-sdk/anthropic"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as z from "zod"

import { askRequestSchema } from "./ask-request"
import { askResponseSchema } from "./ask-response"
import { createPliantHandler } from "./create-pliant-handler"

const demoSchema = z.strictObject({
  surface: z.string(),
  targets: z.array(
    z.strictObject({
      target: z.string(),
      context: z.unknown(),
      prompts: z.array(z.string()),
    })
  ),
})

const demo = demoSchema.parse(
  JSON.parse(
    await readFile(
      new URL("../scripts/demo-asks.json", import.meta.url),
      "utf8"
    )
  )
)

const asks = demo.targets.flatMap(({ target, context, prompts }) =>
  prompts.map((prompt) =>
    askRequestSchema.parse({ surface: demo.surface, target, prompt, context })
  )
)

const handler = createPliantHandler({
  model: anthropic("claude-haiku-5-5"),
  recordings: {
    mode: "replay",
    directory: new URL("../recordings", import.meta.url).pathname,
  },
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("committed recordings", () => {
  it.each(asks.map((ask) => [`${ask.target}: ${ask.prompt}`, ask] as const))(
    "replay %s",
    async (_, ask) => {
      vi.spyOn(console, "warn").mockImplementation(() => undefined)
      const response = await handler(
        new Request("http://localhost/api/pliant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ask),
        })
      )
      const body = askResponseSchema.parse(await response.json())

      expect(body.status, JSON.stringify(body)).not.toBe("error")
    }
  )
})
