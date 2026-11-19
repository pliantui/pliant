import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { anthropic } from "@ai-sdk/anthropic"
import { wrapLanguageModel } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as z from "zod"

import {
  askRequestSchema,
  askResponseSchema,
  createPliantHandler,
} from "@pliantui/server"
import { recordingMiddleware } from "@pliantui/server/recordings"

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
      new URL("../../../scripts/demo-asks.json", import.meta.url),
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
  model: wrapLanguageModel({
    model: anthropic("claude-haiku-5-5"),
    middleware: recordingMiddleware({
      mode: "replay",
      directory: fileURLToPath(new URL("../../../recordings", import.meta.url)),
    }),
  }),
  getUser: () => "anonymous",
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("committed recordings", () => {
  it("replay every demo ask to its recorded answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const answers: unknown[] = []
    for (const ask of asks) {
      const response = await handler(
        new Request("http://localhost/api/pliant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(ask),
        })
      )
      const body = askResponseSchema.parse(await response.json())
      answers.push({
        ask: `${ask.target}: ${ask.prompt}`,
        ...(body.status === "ok"
          ? {
              status: body.status,
              ops: body.overlay.ops,
              explain: body.explain,
            }
          : body),
      })
    }

    expect(answers).toMatchInlineSnapshot(`
      [
        {
          "ask": "orders-table: sort by value, highest first",
          "explain": [
            "Sorted by value, highest first.",
          ],
          "ops": [
            {
              "op": "setSort",
              "sort": [
                {
                  "dir": "desc",
                  "field": "value",
                },
              ],
              "target": "orders-table",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: hide the notes column",
          "explain": [
            "Hid the Notes column from the orders table.",
          ],
          "ops": [
            {
              "op": "hide",
              "target": "orders-table/columns/notes",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: only show overdue orders",
          "explain": [
            "Filtered table to show only overdue orders.",
          ],
          "ops": [
            {
              "filter": {
                "field": "status",
                "operator": "eq",
                "value": "overdue",
              },
              "op": "setFilter",
              "target": "orders-table",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: put customer before order",
          "explain": [
            "Moved Customer column before Order.",
          ],
          "ops": [
            {
              "op": "move",
              "target": "orders-table/columns/customer",
              "to": {
                "before": "id",
              },
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: pin the order column",
          "explain": [
            "Pinned the Order column to the start of the table.",
          ],
          "ops": [
            {
              "op": "pin",
              "target": "orders-table/columns/id",
              "where": "start",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: make the customer column 240 pixels wide",
          "explain": [
            "Set the Customer column width to 240 pixels.",
          ],
          "ops": [
            {
              "op": "setColumnWidth",
              "target": "orders-table/columns/customer",
              "width": 240,
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: newest first and hide region",
          "explain": [
            "Sorted by created date, newest first.",
            "Hid the Region column.",
          ],
          "ops": [
            {
              "op": "setSort",
              "sort": [
                {
                  "dir": "desc",
                  "field": "createdAt",
                },
              ],
              "target": "orders-table",
            },
            {
              "op": "hide",
              "target": "orders-table/columns/region",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "orders-table: make it nicer",
          "question": "What would make the orders table nicer for you: easier scanning, a cleaner layout, or something specific like sorting or hiding columns?",
          "status": "clarify",
        },
        {
          "ask": "key-metrics: put the overdue card first",
          "explain": [
            "Moved the Overdue card to the first position.",
          ],
          "ops": [
            {
              "op": "move",
              "target": "key-metrics/slots/overdue",
              "to": {
                "index": 0,
              },
            },
          ],
          "status": "ok",
        },
        {
          "ask": "key-metrics: hide the average order value card",
          "explain": [
            "Hid the Average order value card from the key metrics row.",
          ],
          "ops": [
            {
              "op": "hide",
              "target": "key-metrics/slots/average-order-value",
            },
          ],
          "status": "ok",
        },
        {
          "ask": "key-metrics: show the cards in a two-column grid",
          "explain": [
            "Arranged the metric cards in a two-column grid.",
          ],
          "ops": [
            {
              "columns": 2,
              "mode": "grid",
              "op": "setLayout",
              "target": "key-metrics",
            },
          ],
          "status": "ok",
        },
      ]
    `)
  })
})
