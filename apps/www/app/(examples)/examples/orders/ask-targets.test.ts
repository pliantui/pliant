import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import * as z from "zod"

import { askContextSchema } from "@pliantui/server"

import { askTargets } from "./ask-targets"

const demoAsksSchema = z.object({
  surface: z.string(),
  targets: z.array(
    z.object({
      target: z.string(),
      context: z.unknown(),
      prompts: z.array(z.string()),
    })
  ),
})

describe("askTargets", () => {
  it("are valid ask contexts", () => {
    for (const { context } of askTargets) {
      expect(askContextSchema.safeParse(context).success).toBe(true)
    }
  })

  // Replays are keyed by the exact context, so a
  // context that drifts from the recorded asks has no answer.
  it("are recorded demo asks", async () => {
    const demo = demoAsksSchema.parse(
      JSON.parse(
        await readFile(
          new URL("../../../../scripts/demo-asks.json", import.meta.url),
          "utf8"
        )
      )
    )

    expect(demo.surface).toBe("/examples/orders")
    expect(askTargets.map(({ id }) => id).sort()).toEqual(
      demo.targets.map(({ target }) => target).sort()
    )
    for (const { id, context, suggestions } of askTargets) {
      const recorded = demo.targets.find(({ target }) => target === id)
      expect(recorded).toBeDefined()
      expect(context).toEqual(recorded?.context)
      expect(suggestions).toEqual(recorded?.prompts)
    }
  })
})
