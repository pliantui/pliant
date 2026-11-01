import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { overlaySchema } from "./overlay"

const fixture = readFixture("overlay")

describe("overlaySchema", () => {
  it.each(fixture.valid)("accepts %j", (overlay) => {
    expect(overlaySchema.safeParse(overlay).success).toBe(true)
  })

  it.each(fixture.invalid)("rejects %j", (overlay) => {
    expect(overlaySchema.safeParse(overlay).success).toBe(false)
  })

  it.each(fixture.crossField)("reports $message for $value", (entry) => {
    expectCrossFieldIssue(overlaySchema, entry)
  })

  it("keeps ops, targets and fields from newer versions", () => {
    const overlays = fixture.valid.map((overlay) =>
      overlaySchema.parse(overlay)
    )
    expect(overlays.flatMap((overlay) => overlay.ops)).toContainEqual({
      op: "pinColumns",
      target: "@page",
      side: "left",
    })
    expect(overlays).toContainEqual(
      expect.objectContaining({ future: { kept: true } })
    )
  })
})
