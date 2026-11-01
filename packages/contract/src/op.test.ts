import { describe, expect, it } from "vitest"

import { readOpFixtures } from "../test/fixtures"
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
})
