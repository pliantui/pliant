import { describe, expect, it } from "vitest"

import { readFixture } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { savedViewSchema } from "./saved-view"

const fixture = readFixture("saved-view")

describe("savedViewSchema", () => {
  it.each(fixture.valid)("accepts %j", (view) => {
    expect(savedViewSchema.safeParse(view).success).toBe(true)
  })

  it.each(fixture.invalid)("rejects %j", (view) => {
    expect(savedViewSchema.safeParse(view).success).toBe(false)
  })

  it.each(fixture.crossField)("reports $message for $value", (entry) => {
    expectCrossFieldIssue(savedViewSchema, entry)
  })
})
