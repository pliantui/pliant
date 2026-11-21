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

  it("puts numbers before text", () => {
    expect(sorted("1", 10, "a", 2)).toEqual([2, 10, "1", "a"])
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
