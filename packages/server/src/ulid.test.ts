import { describe, expect, it } from "vitest"

import { ulid } from "./ulid"

describe("ulid", () => {
  it("encodes the time in the first ten characters", () => {
    expect(ulid(0).slice(0, 10)).toBe("0000000000")
    expect(ulid(1_469_918_176_385).slice(0, 10)).toBe("01ARYZ6S41")
  })

  it("makes valid, distinct ULIDs", () => {
    const ids = Array.from({ length: 50 }, () => ulid(Date.now()))
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
    }
  })
})
