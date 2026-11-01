import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchema, overlaySchema } from "@pliantui/contract"

import { formatError } from "./format-error"

function issue(path: PropertyKey[], message: string): z.core.$ZodIssue {
  return { code: "custom", path, message }
}

function unionError() {
  const result = opSchema.safeParse({
    op: "addDerived",
    target: "orders-table",
    id: "x",
    label: "X",
    expr: { fn: "sum", args: [{ nope: 1 }] },
  })
  expect(result.success).toBe(false)
  return result.error ?? new z.ZodError([])
}

describe("formatError", () => {
  it("writes one line per issue with its path", () => {
    const error = new z.ZodError([
      issue(["ops", 0, "target"], "Must be an address"),
      issue(["basis", "manifests", "acme:rating", "0"], "Bad key"),
      issue([], "Invalid overlay"),
    ])
    expect(formatError(error)).toBe(
      [
        "ops[0].target: Must be an address",
        'basis.manifests["acme:rating"]["0"]: Bad key',
        "Invalid overlay",
      ].join("\n")
    )
  })

  it("caps the number of issues and says how many were left out", () => {
    const error = new z.ZodError(
      Array.from({ length: 5 }, (_, index) => issue(["ops", index], "Bad op"))
    )
    expect(formatError(error, { maxIssues: 2 })).toBe(
      "ops[0]: Bad op\nops[1]: Bad op\nand 3 more issues"
    )
  })

  it("shows every top-level issue before nested union detail", () => {
    const union = unionError().issues
    const error = new z.ZodError([
      ...union,
      issue(["ops", 1, "label"], "Too small"),
    ])
    const lines = formatError(error, { maxIssues: 4 }).split("\n")
    expect(lines).toHaveLength(4)
    expect(lines).toContain("ops[1].label: Too small")
  })

  it("prefixes nested lines with the full path and drops duplicates", () => {
    const lines = formatError(unionError(), { maxIssues: 100 }).split("\n")
    expect(lines[0]).toBe("expr: Invalid input")
    expect(lines).toContain(
      "  expr.field: Invalid input: expected string, received undefined"
    )
    expect(lines).toContain(
      "    expr.args[0].field: Invalid input: expected string, received undefined"
    )
    expect(new Set(lines).size).toBe(lines.length)
  })

  it("follows invalid record keys", () => {
    const result = overlaySchema.safeParse({
      v: 1,
      id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
      surface: "/orders",
      layer: "personal",
      ops: [{ op: "hide", target: "orders-table" }],
      basis: { contract: 1, core: "0.1.0", manifests: { "Bad Key": 1 } },
      source: "manual",
      createdBy: "user_123",
      createdAt: "2026-11-01T09:30:00.000Z",
    })
    expect(result.success).toBe(false)
    const lines = formatError(result.error ?? new z.ZodError([])).split("\n")
    expect(lines[0]).toMatch(/^basis\.manifests\["Bad Key"\]: /)
    expect(lines[1]).toMatch(
      /^ {2}basis\.manifests\["Bad Key"\]: Must be kebab-case/
    )
  })

  it("caps the depth of nested union errors", () => {
    const error = unionError()
    expect(
      formatError(error, { maxDepth: 0, maxIssues: 100 }).split("\n")
    ).toHaveLength(1)
    expect(
      formatError(error, { maxDepth: 3, maxIssues: 100 }).split("\n").length
    ).toBeGreaterThan(1)
  })

  it("doesn't spend the line budget on duplicate nested lines", () => {
    const union: z.core.$ZodIssue = {
      code: "invalid_union",
      path: ["expr"],
      message: "Invalid input",
      errors: [
        [issue(["field"], "Expected string")],
        [issue(["field"], "Expected string")],
        [issue(["ref"], "Expected string")],
      ],
    }
    expect(formatError(new z.ZodError([union]), { maxIssues: 3 })).toBe(
      [
        "expr: Invalid input",
        "  expr.field: Expected string",
        "  expr.ref: Expected string",
      ].join("\n")
    )
  })

  it("counts a single left-out issue", () => {
    const error = new z.ZodError([issue([], "a"), issue([], "b")])
    expect(formatError(error, { maxIssues: 1 })).toBe("a\nand 1 more issue")
  })

  it("caps the length without splitting a surrogate pair", () => {
    expect(
      formatError(new z.ZodError([issue([], "x".repeat(100))]), {
        maxLength: 10,
      })
    ).toBe("xxxxxxxxx…")
    expect(
      formatError(new z.ZodError([issue([], "ab\u{1F600}cd")]), {
        maxLength: 4,
      })
    ).toBe("ab…")
  })

  it.each([
    { maxIssues: 0 },
    { maxIssues: 1.5 },
    { maxDepth: -1 },
    { maxLength: 0 },
    { maxLength: Number.NaN },
  ])("rejects %j", (options) => {
    expect(() => formatError(new z.ZodError([]), options)).toThrow(RangeError)
  })
})
