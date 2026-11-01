import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchema } from "@pliantui/contract"

import { formatIssues } from "./format-issues"

function issue(path: PropertyKey[], message: string): z.core.$ZodIssue {
  return { code: "custom", path, message, input: undefined }
}

describe("formatIssues", () => {
  it("writes one line per issue with its path", () => {
    const error = new z.ZodError([
      issue(["ops", 0, "target"], "Must be an address"),
      issue([], "Invalid overlay"),
    ])
    expect(formatIssues(error)).toBe(
      "ops[0].target: Must be an address\nInvalid overlay"
    )
  })

  it("caps the number of issues and says how many were left out", () => {
    const error = new z.ZodError(
      Array.from({ length: 5 }, (_, index) => issue(["ops", index], "Bad op"))
    )
    expect(formatIssues(error, { maxIssues: 2 })).toBe(
      "ops[0]: Bad op\nops[1]: Bad op\nand 3 more"
    )
  })

  it("caps the depth of nested union errors", () => {
    const result = opSchema.safeParse({
      op: "addDerived",
      target: "orders-table",
      id: "x",
      label: "X",
      expr: { fn: "sum", args: [{ nope: 1 }] },
    })
    const shallow = formatIssues(result.error ?? new z.ZodError([]), {
      maxDepth: 0,
      maxIssues: 100,
    })
    const deep = formatIssues(result.error ?? new z.ZodError([]), {
      maxDepth: 3,
      maxIssues: 100,
    })
    expect(shallow.split("\n")).toHaveLength(1)
    expect(deep.split("\n").length).toBeGreaterThan(1)
  })

  it("caps the length of the result", () => {
    const error = new z.ZodError([issue([], "x".repeat(100))])
    expect(formatIssues(error, { maxLength: 10 })).toBe("xxxxxxxxx…")
  })
})
