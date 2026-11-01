import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { overlaySchema } from "./overlay"

const fixture = readFixture("overlay")

describe("overlaySchema", () => {
  it.each(fixture.valid)("accepts %j", (overlay) => {
    expect(overlaySchema.safeParse(overlay).success).toBe(true)
  })

  it.each(fixture.invalid)("rejects %j", (overlay) => {
    expect(overlaySchema.safeParse(overlay).success).toBe(false)
  })

  it("keeps unknown ops and their arguments for the runtime to skip", () => {
    const [, , future] = fixture.valid
    expect(overlaySchema.parse(future).ops).toEqual([
      { op: "setTheme", target: "@app", theme: "ocean" },
    ])
  })
})
