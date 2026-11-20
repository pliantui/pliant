import { filterFn_inNumberRange } from "@tanstack/react-table"
import { describe, expect, it } from "vitest"

import type { FilterValue } from "@pliantui/core"

import {
  isEmptyFilterValue,
  matchesFilter,
  rawFilterValueOf,
} from "./pliant-filter-fns"

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

  it("compares values that compare, numbers with numeric text", () => {
    expect(matchesFilter(5, { operator: "eq", value: 5 })).toBe(true)
    expect(matchesFilter("5", { operator: "eq", value: 5 })).toBe(true)
    expect(matchesFilter("five", { operator: "eq", value: 5 })).toBe(false)
    expect(matchesFilter("five", { operator: "neq", value: 5 })).toBe(true)
    expect(matchesFilter(5, { operator: "eq", value: "5" })).toBe(true)
    expect(matchesFilter(12, { operator: "gt", value: "9" })).toBe(true)
    expect(matchesFilter("Paid", { operator: "eq", value: "paid" })).toBe(false)
    expect(matchesFilter("Paid", { operator: "in", value: ["paid"] })).toBe(
      false
    )
    expect(matchesFilter(5, { operator: "gte", value: 5 })).toBe(true)
    expect(matchesFilter(5, { operator: "gt", value: 5 })).toBe(false)
    expect(matchesFilter("b", { operator: "lt", value: "c" })).toBe(true)
    expect(matchesFilter("b", { operator: "lt", value: 3 })).toBe(false)
    expect(matchesFilter(true, { operator: "eq", value: true })).toBe(true)
    expect(matchesFilter(true, { operator: "gt", value: false })).toBe(false)
  })

  it("excludes the value itself from lt and matches any value of in", () => {
    expect(matchesFilter(5, { operator: "lt", value: 5 })).toBe(false)
    expect(matchesFilter("b", { operator: "in", value: ["a", "b"] })).toBe(true)
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

describe("range inputs", () => {
  const ranges: unknown[] = [
    [undefined, 20],
    [10, undefined],
    ["10", "20"],
    [20, 10],
    [null, 5],
    ["", "7"],
    [5, 5],
    ["-3", 0],
  ]

  it("filters as TanStack's inNumberRange", () => {
    for (const range of ranges) {
      const filter = rawFilterValueOf(range)
      expect(filter, JSON.stringify(range)).toBeDefined()
      const resolved: unknown =
        filterFn_inNumberRange.resolveFilterValue?.(range)
      for (let cell = -5; cell <= 30; cell++) {
        expect(
          filter && matchesFilter(cell, filter),
          `${String(cell)} in ${JSON.stringify(range)}`
        ).toBe(
          Boolean(
            Reflect.apply(filterFn_inNumberRange.filter, undefined, [
              cell,
              resolved,
            ])
          )
        )
      }
    }
  })

  it("is removed when TanStack removes it", () => {
    for (const value of [
      undefined,
      null,
      "",
      [],
      [undefined, undefined],
      [null, ""],
      [1, undefined],
      ["", 2],
      "a",
      0,
    ]) {
      expect(isEmptyFilterValue(value), JSON.stringify(value)).toBe(
        filterFn_inNumberRange.autoRemove?.(value) ?? false
      )
    }
  })
})

describe("dates", () => {
  it("runs in a zone behind UTC", () => {
    expect(new Date(2026, 2, 1).getTimezoneOffset()).toBe(300)
  })

  it("leaves out the instant before midnight and dates with trailing text", () => {
    const beforeMidnight = new Date(new Date(2026, 2, 1).getTime() - 1)
    expect(
      matchesFilter(beforeMidnight, { operator: "eq", value: "2026-03-01" })
    ).toBe(false)
    expect(
      matchesFilter(new Date(2026, 2, 1, 12), {
        operator: "eq",
        value: "2026-03-01 or so",
      })
    ).toBe(false)
  })

  it("reads a date without a time as a day in the viewer's zone", () => {
    const lateEvening = new Date("2026-03-01T03:00:00Z")
    expect(
      matchesFilter(lateEvening, { operator: "eq", value: "2026-03-01" })
    ).toBe(false)
    expect(
      matchesFilter(lateEvening, { operator: "eq", value: "2026-02-28" })
    ).toBe(true)
    expect(
      matchesFilter(lateEvening, { operator: "lt", value: "2026-03-01" })
    ).toBe(true)
    expect(
      matchesFilter(new Date("2026-03-02T04:30:00Z"), {
        operator: "between",
        value: ["2026-03-01", "2026-03-01"],
      })
    ).toBe(true)
    expect(
      matchesFilter(new Date("2026-03-02T05:00:00Z"), {
        operator: "lte",
        value: "2026-03-01",
      })
    ).toBe(false)
  })

  it("reads dates before year 100 and leaves out days that don't exist", () => {
    expect(
      matchesFilter(new Date(new Date(0).setFullYear(50, 0, 1)), {
        operator: "eq",
        value: "0050-01-01",
      })
    ).toBe(true)
    expect(
      matchesFilter(new Date(2026, 2, 3), {
        operator: "eq",
        value: "2026-02-31",
      })
    ).toBe(false)
    expect(
      matchesFilter(new Date(2026, 2, 3), {
        operator: "neq",
        value: "2026-02-31",
      })
    ).toBe(true)
  })

  it("compares both ways alike", () => {
    const time = new Date("2026-03-01T12:00:00Z")
    expect(
      matchesFilter(time.getTime(), {
        operator: "eq",
        value: time.toISOString(),
      })
    ).toBe(true)
    expect(matchesFilter(time, { operator: "eq", value: time.getTime() })).toBe(
      true
    )
    expect(matchesFilter("12", { operator: "gt", value: 9 })).toBe(true)
    expect(matchesFilter(12, { operator: "gt", value: "9" })).toBe(true)
  })

  it("compares ISO text as dates, not as text", () => {
    expect(
      matchesFilter("2026-03-01T00:00:00-05:00", {
        operator: "eq",
        value: "2026-03-01",
      })
    ).toBe(true)
    expect(
      matchesFilter("2026-03-01", {
        operator: "gt",
        value: "2026-02-28T23:00:00-05:00",
      })
    ).toBe(true)
    expect(
      matchesFilter("2026-03-01", { operator: "eq", value: "March" })
    ).toBe(false)
  })
})
