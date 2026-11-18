import { describe, expect, it } from "vitest"

import { compareInstants, parseInstant } from "./instant"

const compare = (a: string, b: string) =>
  Math.sign(compareInstants(parseInstant(a), parseInstant(b)))

describe("parseInstant", () => {
  it("reads seconds and trims trailing zeros from the fraction", () => {
    expect(parseInstant("2026-11-01T10:00:00.120000000+01:00")).toEqual({
      seconds: 1_793_523_600,
      fraction: "12",
    })
  })

  it.each(["", "yesterday", "2026-11-01T10:00:00", "2026-13-45T99:00:00Z"])(
    "returns undefined for %j",
    (value) => {
      expect(parseInstant(value)).toBeUndefined()
    }
  )
})

describe("compareInstants", () => {
  it.each([
    ["2026-11-01T10:00:00Z", "2026-11-01T10:00:00.000000001Z", -1],
    ["2026-11-01T10:00:00.5Z", "2026-11-01T10:00:00.49Z", 1],
    ["2026-11-01T10:00:00.10Z", "2026-11-01T10:00:00.1Z", 0],
    ["2026-11-01T11:00:00+01:00", "2026-11-01T10:00:00Z", 0],
    ["2026-11-01T10:00:00.999999999Z", "2026-11-01T10:00:01Z", -1],
    ["nope", "2026-11-01T10:00:00Z", -1],
    ["nope", "never", 0],
  ])("compares %s with %s as %d", (a, b, expected) => {
    expect(compare(a, b)).toBe(expected)
    expect(compare(b, a)).toBe(-expected || 0)
  })
})
