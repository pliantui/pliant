import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  checkExpression,
  formatError,
  validateOverlay,
  type ExpressionField,
  type ExpressionKind,
  type ValidatedOverlay,
} from "@pliantui/core"

const docs = path.join(import.meta.dirname, "../../content/docs")

// The dataset the examples describe: an orders table.
const fields: Record<string, ExpressionField> = {
  price: { type: "currency", currency: "USD" },
  cost: { type: "currency", currency: "USD" },
  value: { type: "currency", currency: "USD" },
  dueDate: { type: "date" },
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function jsonExamples() {
  const examples: { name: string; source: string }[] = []
  let fences = 0
  for (const file of readdirSync(docs, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".mdx")) {
      continue
    }
    const text = readFileSync(path.join(docs, file), "utf8")
    const blocks = [
      ...text.matchAll(/^[ \t]*```json[^\n]*\n([\s\S]*?)^[ \t]*```$/gm),
    ]
    fences += text.match(/```json/g)?.length ?? 0
    for (const [index, match] of blocks.entries()) {
      examples.push({
        name: `${file} #${String(index + 1)}`,
        source: match[1] ?? "",
      })
    }
  }
  return { examples, fences }
}

function overlayOf(op: unknown) {
  return {
    v: 1,
    id: "01JD5Z8Q9W3X4Y5Z6A7B8C9D0E",
    surface: "/orders",
    layer: "personal",
    ops: [op],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-20T09:30:00Z",
  }
}

type Op = ValidatedOverlay["ops"][number]
type Expression = Parameters<typeof checkExpression>[0]

function expressionsOf(op: Op): [Expression, ExpressionKind][] {
  switch (op.op) {
    case "addDerived":
      return [[op.expr, "row"]]
    case "addAggregate":
      return [[op.expr, "aggregate"]]
    case "addHighlight":
      return [[op.when, "row"]]
    default:
      return []
  }
}

function expectValid(overlay: Json) {
  const result = validateOverlay(overlay)
  expect(result.success ? undefined : formatError(result.error)).toBeUndefined()
  for (const op of result.data?.ops ?? []) {
    for (const [expression, kind] of expressionsOf(op)) {
      const checked = checkExpression(expression, { fields, kind })
      expect(
        checked.success ? undefined : formatError(checked.error),
        JSON.stringify(expression)
      ).toBeUndefined()
    }
  }
}

const { examples, fences } = jsonExamples()

it("finds every JSON example", () => {
  expect(examples.length).toBeGreaterThan(0)
  expect(examples).toHaveLength(fences)
})

describe.each(examples)("$name", ({ source }) => {
  it("is valid against the contract", () => {
    const example: unknown = JSON.parse(source)
    if (!isObject(example)) {
      throw new TypeError("A JSON example must be an object")
    }
    if ("ops" in example) {
      expectValid(example)
    } else if ("op" in example) {
      expectValid(overlayOf(example))
    } else if (["field", "value", "ref", "fn"].some((key) => key in example)) {
      expectValid(
        overlayOf({
          op: "addDerived",
          target: "orders-table",
          id: "example",
          label: "Example",
          expr: example,
        })
      )
    } else {
      throw new TypeError(
        "A JSON example must be an overlay, an op or an expression"
      )
    }
  })
})
