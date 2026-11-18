import { describe, expect, it } from "vitest"

import { askRequestSchema, type AskRequest } from "./ask-request"

const ask: AskRequest = {
  surface: "/examples/orders",
  target: "orders-table",
  prompt: "sort by value",
  context: {
    manifest: {
      kind: "data-table",
      version: 1,
      description: "A table of orders",
      capabilities: { data: true },
    },
    collection: { name: "columns", items: [{ id: "value", label: "Value" }] },
    fields: [
      { id: "value", type: "number" },
      { id: "status", type: "enum", values: ["paid", "overdue"] },
    ],
    sort: [{ field: "value", dir: "asc" }],
    filters: [{ field: "status", operator: "eq", value: "paid" }],
  },
}

function withContext(context: object) {
  return { ...ask, context: { ...ask.context, ...context } }
}

describe("askRequestSchema", () => {
  it("accepts an ask with its context", () => {
    expect(askRequestSchema.parse(ask)).toEqual(ask)
  })

  it("trims the prompt", () => {
    expect(
      askRequestSchema.parse({ ...ask, prompt: "  hide notes " }).prompt
    ).toBe("hide notes")
  })

  it.each<[string, unknown]>([
    ["an empty prompt", { ...ask, prompt: "   " }],
    ["a prompt over 500 characters", { ...ask, prompt: "a".repeat(501) }],
    ["a target that isn't an address", { ...ask, target: "@app" }],
    ["a surface that isn't a route", { ...ask, surface: "orders page" }],
    ["an unknown key", { ...ask, locale: "en" }],
    [
      "an invalid manifest",
      withContext({
        manifest: { ...ask.context.manifest, capabilities: { hidable: true } },
      }),
    ],
    [
      "duplicate item ids",
      withContext({
        collection: { name: "columns", items: [{ id: "a" }, { id: "a" }] },
      }),
    ],
    [
      "a slot id that isn't kebab-case",
      withContext({
        collection: { name: "slots", items: [{ id: "Revenue" }] },
      }),
    ],
    [
      "more than 50 items",
      withContext({
        collection: {
          name: "columns",
          items: Array.from({ length: 51 }, (_, index) => ({
            id: `c${String(index)}`,
          })),
        },
      }),
    ],
    [
      "duplicate field ids",
      withContext({
        fields: [
          { id: "a", type: "text" },
          { id: "a", type: "number" },
        ],
      }),
    ],
    [
      "values on a field that isn't an enum",
      withContext({ fields: [{ id: "a", type: "text", values: ["x"] }] }),
    ],
    [
      "an enum field without values",
      withContext({ fields: [{ id: "a", type: "enum" }] }),
    ],
    [
      "an enum value over 40 characters",
      withContext({
        fields: [{ id: "a", type: "enum", values: ["x".repeat(41)] }],
      }),
    ],
    [
      "a label over 80 characters",
      withContext({
        collection: {
          name: "columns",
          items: [{ id: "a", label: "x".repeat(81) }],
        },
      }),
    ],
  ])("rejects %s", (_, input) => {
    expect(askRequestSchema.safeParse(input).success).toBe(false)
  })
})
