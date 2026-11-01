import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { overlaySchema } from "./overlay"

const fixture = readFixture("overlay")

describe("overlaySchema", () => {
  it.each(fixture.valid)("accepts %j", (overlay) => {
    expect(overlaySchema.safeParse(overlay).success).toBe(true)
  })

  it.each([...fixture.invalid, ...(fixture.crossField ?? [])])(
    "rejects %j",
    (overlay) => {
      expect(overlaySchema.safeParse(overlay).success).toBe(false)
    }
  )

  it("keeps ops it doesn't recognise, with their arguments", () => {
    const ops = fixture.valid.flatMap(
      (overlay) => overlaySchema.parse(overlay).ops
    )
    expect(ops).toContainEqual({
      op: "setTheme",
      target: "orders-table",
      theme: "ocean",
    })
  })
})
