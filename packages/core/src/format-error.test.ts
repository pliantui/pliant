import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchema } from "@pliantui/contract"

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

  it("caps the depth of nested union errors", () => {
    const error = unionError()
    expect(
      formatError(error, { maxDepth: 0, maxIssues: 100 }).split("\n")
    ).toHaveLength(1)
    expect(
      formatError(error, { maxDepth: 3, maxIssues: 100 }).split("\n").length
    ).toBeGreaterThan(1)
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
