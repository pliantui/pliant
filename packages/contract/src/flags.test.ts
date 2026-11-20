import { describe, expect, it } from "vitest"

import { flagsSchema } from "./flags"

describe("flagsSchema", () => {
  it.each([
    {},
    { primary: true },
    { primary: false },
    { primary: true, critical: true, pinned: true, locked: true },
    { primary: true, destructive: true },
  ])("accepts %j", (flags) => {
    expect(flagsSchema.safeParse(flags).success).toBe(true)
  })

  it.each([
    { primary: "true" },
    { primary: 1 },
    { primary: null },
    { main: true },
  ])("rejects %j", (flags) => {
    expect(flagsSchema.safeParse(flags).success).toBe(false)
  })
})
