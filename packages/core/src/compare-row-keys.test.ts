import { describe, expect, it } from "vitest"

import { compareRowKeys } from "./compare-row-keys"

const sorted = (...keys: unknown[]) => keys.toSorted(compareRowKeys)

describe("compareRowKeys", () => {
  it("compares numbers numerically", () => {
    expect(sorted(2, 10, 9, -1, 0.5)).toEqual([-1, 0.5, 2, 9, 10])
  })

  it("compares text by code point", () => {
    expect(sorted("9", "10", "2", "\u{1F600}", "￿")).toEqual([
      "10",
      "2",
      "9",
      "￿",
      "\u{1F600}",
    ])
  })

  it("puts number keys before text keys", () => {
    expect(sorted("a", 2, "10", "1")).toEqual([2, "1", "10", "a"])
    expect(sorted("B", 10)).toEqual([10, "B"])
    expect(sorted(9, "10")).toEqual([9, "10"])
    expect(sorted("15", 10, 2)).toEqual([2, 10, "15"])
  })

  it("orders mixed keys the same whatever order they start in", () => {
    const keys = [10, "15", 2, "a", 1.5, "1"]
    const expected = [1.5, 2, 10, "1", "15", "a"]
    expect(sorted(...keys)).toEqual(expected)
    expect(sorted(...keys.toReversed())).toEqual(expected)
  })

  it("compares NaN and missing keys as text", () => {
    expect(sorted(Number.NaN, undefined, 3, "M")).toEqual([
      3,
      "M",
      Number.NaN,
      undefined,
    ])
  })
})
