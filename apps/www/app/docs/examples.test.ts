import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { functionCatalog, opCatalog } from "@pliantui/contract"
import {
  checkExpression,
  formatError,
  validateOverlay,
  type ExpressionField,
  type ExpressionKind,
  type ValidatedOverlay,
} from "@pliantui/core"

const docs = path.join(import.meta.dirname, "../../content/docs")

// The dataset the examples describe: the orders table of the orders example.
const fields: Record<string, ExpressionField> = {
  id: { type: "id" },
  customer: { type: "string" },
  region: { type: "enum" },
  status: { type: "enum" },
  value: { type: "currency", currency: "INR" },
  createdAt: { type: "datetime" },
  notes: { type: "text" },
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function jsonExamples() {
  const examples: { name: string; title: string; source: string }[] = []
  let fences = 0
  for (const file of readdirSync(docs, { recursive: true, encoding: "utf8" })) {
    if (!file.endsWith(".mdx")) {
      continue
    }
    const text = readFileSync(path.join(docs, file), "utf8")
    const blocks = [
      ...text.matchAll(/^[ \t]*```json([^\n]*)\n([\s\S]*?)^[ \t]*```$/gm),
    ]
    fences += text.match(/```json/g)?.length ?? 0
    for (const [index, match] of blocks.entries()) {
      examples.push({
        name: `${file} #${String(index + 1)}`,
        title: /title="([^"]*)"/.exec(match[1] ?? "")?.[1] ?? "",
        source: match[2] ?? "",
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

describe.each(examples)("$name", ({ title, source }) => {
  it("is valid against the contract", () => {
    const example: unknown = JSON.parse(source)
    if (!isObject(example)) {
      throw new TypeError("A JSON example must be an object")
    }
    if (title.endsWith("manifest-decisions.json")) {
      // The CLI's own decisions file, not part of the contract. The pliantui
      // tests cover its format; this only checks the example's shape.
      expect(typeof example["namespace"]).toBe("string")
      expect(isObject(example["components"])).toBe(true)
    } else if ("ops" in example) {
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

function readDoc(name: string) {
  return readFileSync(path.join(docs, name), "utf8")
}

function namesIn(text: string) {
  return [...text.matchAll(/`([a-z][A-Za-z0-9]*)`/g)].map(([, name]) => name)
}

// The second column of the body rows of the Markdown table whose header
// row starts with `header`.
function tableColumn(text: string, header: string) {
  const lines = text.split("\n")
  const start = lines.findIndex((line) => line.startsWith(header))
  const end = lines.findIndex(
    (line, index) => index > start && !line.startsWith("|")
  )
  return lines
    .slice(start + 2, end)
    .map((row) => row.split("|")[2] ?? "")
    .join(" ")
}

it("lists every op in the catalog by capability", () => {
  const text = readDoc("concepts/operations.mdx")
  const section = text.slice(
    text.indexOf("## A closed catalog"),
    text.indexOf("The catalog is part of")
  )
  const listed = [
    ...namesIn(tableColumn(section, "| Capability")),
    ...namesIn(
      section
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .join(" ")
    ),
  ]
  expect([...new Set(listed)].toSorted()).toEqual(
    Object.keys(opCatalog).toSorted()
  )
})

it("lists every function in the catalog", () => {
  const text = readDoc("concepts/expressions.mdx")
  expect(namesIn(tableColumn(text, "| Group")).toSorted()).toEqual(
    Object.keys(functionCatalog.functions).toSorted()
  )
})
