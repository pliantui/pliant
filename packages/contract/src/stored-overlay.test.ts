import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { overlaySchema } from "./overlay"
import { storedOverlaySchema } from "./stored-overlay"

const fixture = readFixture("stored-overlay")

describe("storedOverlaySchema", () => {
  it.each(fixture.valid)("accepts %j", (record) => {
    expect(storedOverlaySchema.safeParse(record).success).toBe(true)
  })

  it.each(fixture.invalid)("rejects %j", (record) => {
    expect(storedOverlaySchema.safeParse(record).success).toBe(false)
  })

  it.each(fixture.crossField)("reports $message for $value", (entry) => {
    expectCrossFieldIssue(storedOverlaySchema, entry)
  })

  it("round-trips unknown fields and ops unchanged", () => {
    const records = fixture.valid.map((record) =>
      storedOverlaySchema.parse(record)
    )
    expect(records).toEqual(fixture.valid)
    expect(records).toContainEqual(
      expect.objectContaining({ future: { kept: true } })
    )
    expect(records.map((record) => record.overlay)).toContainEqual(
      expect.objectContaining({ future: { kept: true } })
    )
  })

  it("keeps a tombstone's overlay and deletedAt", () => {
    const tombstones = fixture.valid
      .map((record) => storedOverlaySchema.parse(record))
      .filter((record) => record.deletedAt !== undefined)
    expect(tombstones).not.toHaveLength(0)
    for (const tombstone of tombstones) {
      expect(tombstone.deletedAt).toBe(tombstone.updatedAt)
      expect(overlaySchema.safeParse(tombstone.overlay).success).toBe(true)
    }
  })

  it("accepts a record without deletedAt", () => {
    for (const record of fixture.valid) {
      const live = { ...storedOverlaySchema.parse(record) }
      delete live.deletedAt
      expect(storedOverlaySchema.parse(live)).not.toHaveProperty("deletedAt")
    }
  })

  it("accepts every overlay that overlaySchema accepts", () => {
    for (const overlay of readFixture("overlay").valid) {
      expect(overlaySchema.safeParse(overlay).success).toBe(true)
      expect(
        storedOverlaySchema.safeParse({
          overlay,
          etag: "1",
          version: 1,
          updatedAt: "2026-11-19T10:15:00Z",
        }).success
      ).toBe(true)
    }
  })
})
