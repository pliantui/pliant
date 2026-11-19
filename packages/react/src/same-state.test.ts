import { describe, expect, it } from "vitest"

import { isSameState } from "./same-state"

describe("isSameState", () => {
  it("compares plain data deeply", () => {
    expect(
      isSameState(
        [{ id: "a", value: { operator: "in", value: [1, 2] } }],
        [{ value: { value: [1, 2], operator: "in" }, id: "a" }]
      )
    ).toBe(true)
    expect(isSameState({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(isSameState([1, 2], [2, 1])).toBe(false)
    expect(isSameState(Number.NaN, Number.NaN)).toBe(true)
  })

  it("compares dates by their time", () => {
    expect(
      isSameState(
        [new Date("2026-01-01"), new Date("2026-02-01")],
        [new Date("2026-01-01"), new Date("2026-02-01")]
      )
    ).toBe(true)
    expect(isSameState(new Date("2026-01-01"), new Date("2026-01-02"))).toBe(
      false
    )
    expect(isSameState(new Date("2026-01-01"), "2026-01-01")).toBe(false)
  })

  it("compares other objects by identity", () => {
    expect(isSameState(new URL("https://a.b"), new URL("https://a.b"))).toBe(
      false
    )
    expect(isSameState(new Map(), new Map())).toBe(false)
  })
})
