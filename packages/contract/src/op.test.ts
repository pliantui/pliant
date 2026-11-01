import { describe, expect, it } from "vitest"

import { readOpFixtures } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { opSchema } from "./op"
import { opCatalog } from "./op-catalog"

const fixtures = readOpFixtures()

describe("opSchema", () => {
  it("has a fixture for every op in the catalog, and no others", () => {
    expect([...fixtures.keys()].sort()).toEqual(Object.keys(opCatalog).sort())
  })

  describe.each([...fixtures])("%s", (name, fixture) => {
    it.each(fixture.valid)("accepts %j", (op) => {
      expect(opSchema.parse(op)).toMatchObject({ op: name })
    })

    it.each(fixture.invalid)("rejects %j", (op) => {
      expect(opSchema.safeParse(op).success).toBe(false)
    })

    it.each(fixture.crossField)("reports $message for $value", (entry) => {
      expectCrossFieldIssue(opSchema, entry)
    })
  })

  it("rejects a deeply nested expression without throwing", () => {
    let expr: unknown = { field: "value" }
    for (let depth = 0; depth < 5000; depth++) {
      expr = { fn: "abs", args: [expr] }
    }
    expect(
      opSchema.safeParse({
        op: "addDerived",
        target: "orders-table",
        id: "deep",
        label: "Deep",
        expr,
      }).success
    ).toBe(false)
  })

  const sizeIssue = {
    code: "custom",
    message: "Must have at most 128 nodes and 16 arguments per function",
    path: ["expr"],
  }

  function addDerived(expr: unknown) {
    return {
      op: "addDerived",
      target: "orders-table",
      id: "big",
      label: "Big",
      expr,
    }
  }

  function tree(depth: number): unknown {
    return depth === 0
      ? { field: "1bad" }
      : { fn: "sum", args: Array.from({ length: 16 }, () => tree(depth - 1)) }
  }

  it.each([
    ["a wide tree", tree(4)],
    [
      "a function with 17 arguments",
      { fn: "sum", args: Array.from({ length: 17 }, () => ({ field: "a" })) },
    ],
    [
      "a very long argument list",
      {
        fn: "sum",
        args: Array.from({ length: 100_000 }, () => ({ field: "a" })),
      },
    ],
  ])("rejects %s with one issue, before parsing it", (_, expr) => {
    const result = opSchema.safeParse(addDerived(expr))
    expect(
      result.error?.issues.map(({ code, message, path }) => ({
        code,
        message,
        path,
      }))
    ).toEqual([sizeIssue])
  })
})
