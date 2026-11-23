import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { getSectionsQueries } = await import("./sections-query")

describe("getSectionsQueries", () => {
  it("compiles the filter ask to a parameterized query in the user's workspace", () => {
    const { asks } = getSectionsQueries()

    expect(asks).toHaveLength(1)
    const [ask] = asks
    expect(ask?.filters).toEqual([
      { field: "reviewer", operator: "eq", value: "Eddie Lake" },
      { field: "status", operator: "eq", value: "In Process" },
    ])
    expect(ask?.query.values).toEqual(
      expect.arrayContaining(["acme", "Eddie Lake", "In Process"])
    )
    expect(ask?.query.text).toContain('FROM "sections"')
    expect(ask?.query.text).not.toContain("Eddie Lake")
  })
})
