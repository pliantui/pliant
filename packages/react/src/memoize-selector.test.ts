import { describe, expect, it, vi } from "vitest"

import { memoizeSelector } from "./memoize-selector"

describe("memoizeSelector", () => {
  it("runs once per input", () => {
    const selector = vi.fn((input: { value: number }) => input.value * 2)
    const select = memoizeSelector(selector, Object.is)
    const input = { value: 2 }

    expect(select(input)).toBe(4)
    expect(select(input)).toBe(4)
    expect(selector).toHaveBeenCalledTimes(1)
  })

  it("keeps the last result while it is equal", () => {
    const select = memoizeSelector(
      (input: { values: number[] }) => [...input.values],
      (a, b) => a.length === b.length && a.every((value, i) => value === b[i])
    )
    const first = select({ values: [1, 2] })

    expect(select({ values: [1, 2] })).toBe(first)
    expect(select({ values: [1, 3] })).toEqual([1, 3])
  })
})
