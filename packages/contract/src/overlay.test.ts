import { describe, expect, it } from "vitest"
import * as z from "zod"

import { readFixture } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { overlayOpSchema, overlaySchema } from "./overlay"

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

  it("accepts up to 500 ops", () => {
    const withoutExplain = Object.fromEntries(
      Object.entries(z.looseObject({}).parse(fixture.valid[0])).filter(
        ([key]) => key !== "explain"
      )
    )
    const ops = Array.from({ length: 501 }, () => ({
      op: "hide",
      target: "orders-table",
    }))
    expect(
      overlaySchema.safeParse({ ...withoutExplain, ops: ops.slice(0, 500) })
        .success
    ).toBe(true)
    expect(overlaySchema.safeParse({ ...withoutExplain, ops }).success).toBe(
      false
    )
  })
})

describe("overlayOpSchema", () => {
  it.each([
    { op: "hide", target: "orders-table/columns/value" },
    { op: "setLabel", target: "order-card[]/actions/refund" },
    { op: "pinColumns", target: "@page" },
    { op: "futureOp2", target: "@my-app-2" },
    { op: "a".repeat(64), target: `a${"/b".repeat(127)}c` },
  ])("accepts %j", (op) => {
    expect(overlayOpSchema.safeParse(op).success).toBe(true)
  })

  it.each([
    { op: "Hide", target: "orders-table" },
    { op: "1hide", target: "orders-table" },
    { op: "hide!", target: "orders-table" },
    { op: "!hide", target: "orders-table" },
    { op: "", target: "orders-table" },
    { op: "a".repeat(65), target: "orders-table" },
    { op: "hide", target: "Orders-table" },
    { op: "hide", target: "orders table" },
    { op: "hide", target: "/orders-table" },
    { op: "hide", target: "@App" },
    { op: "hide", target: "@app-" },
    { op: "hide", target: "@app--x" },
    { op: "hide", target: "@-app" },
    { op: "hide", target: `a${"/b".repeat(128)}` },
    { op: "hide" },
  ])("rejects %j", (op) => {
    expect(overlayOpSchema.safeParse(op).success).toBe(false)
  })
})
