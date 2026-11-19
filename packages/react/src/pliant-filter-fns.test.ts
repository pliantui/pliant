import { describe, expect, it } from "vitest"

import type { FilterValue } from "@pliantui/core"

import { matchesFilter, rawFilterValueOf } from "./pliant-filter-fns"

describe("matchesFilter", () => {
  it("matches a missing value only with isNull", () => {
    for (const cell of [null, undefined]) {
      expect(matchesFilter(cell, { operator: "isNull" })).toBe(true)
      expect(matchesFilter(cell, { operator: "neq", value: "paid" })).toBe(
        false
      )
      expect(matchesFilter(cell, { operator: "lt", value: 10 })).toBe(false)
      expect(matchesFilter(cell, { operator: "in", value: ["a"] })).toBe(false)
    }
    expect(matchesFilter("", { operator: "isNull" })).toBe(false)
    expect(matchesFilter(0, { operator: "isNull" })).toBe(false)
  })

  it("compares values of the same type", () => {
    expect(matchesFilter(5, { operator: "eq", value: 5 })).toBe(true)
    expect(matchesFilter("5", { operator: "eq", value: 5 })).toBe(false)
    expect(matchesFilter("5", { operator: "neq", value: 5 })).toBe(true)
    expect(matchesFilter(5, { operator: "gte", value: 5 })).toBe(true)
    expect(matchesFilter(5, { operator: "gt", value: 5 })).toBe(false)
    expect(matchesFilter("b", { operator: "lt", value: "c" })).toBe(true)
    expect(matchesFilter("b", { operator: "lt", value: 3 })).toBe(false)
    expect(matchesFilter(true, { operator: "eq", value: true })).toBe(true)
    expect(matchesFilter(true, { operator: "gt", value: false })).toBe(false)
  })

  it("includes both ends of a range", () => {
    const between: FilterValue = { operator: "between", value: [10, 20] }
    expect(matchesFilter(10, between)).toBe(true)
    expect(matchesFilter(20, between)).toBe(true)
    expect(matchesFilter(21, between)).toBe(false)
  })

  it("compares dates by time, reading text as a date", () => {
    const date = new Date("2026-03-01T00:00:00Z")
    expect(
      matchesFilter(date, {
        operator: "between",
        value: ["2026-01-01", "2026-06-30"],
      })
    ).toBe(true)
    expect(matchesFilter(date, { operator: "gt", value: date.getTime() })).toBe(
      false
    )
  })

  it("matches text case-insensitively", () => {
    expect(matchesFilter("Acme", { operator: "contains", value: "CM" })).toBe(
      true
    )
    expect(matchesFilter("Acme", { operator: "startsWith", value: "ac" })).toBe(
      true
    )
    expect(matchesFilter(1234, { operator: "contains", value: "23" })).toBe(
      true
    )
  })

  it("leaves custom filters to the column's own filter function", () => {
    expect(matchesFilter(null, { operator: "custom", value: 1 })).toBe(true)
  })
})

describe("rawFilterValueOf", () => {
  it("maps raw values from TanStack filter UIs", () => {
    expect(rawFilterValueOf("acme")).toEqual({
      operator: "contains",
      value: "acme",
    })
    expect(rawFilterValueOf(3)).toEqual({ operator: "eq", value: 3 })
    expect(rawFilterValueOf([1, 5])).toEqual({
      operator: "between",
      value: [1, 5],
    })
    expect(rawFilterValueOf(["paid", "overdue"])).toEqual({
      operator: "in",
      value: ["paid", "overdue"],
    })
    expect(rawFilterValueOf({ operator: "isNull" })).toEqual({
      operator: "isNull",
    })
    expect(rawFilterValueOf({ from: 1 })).toBeUndefined()
    expect(rawFilterValueOf([])).toBeUndefined()
  })
})
