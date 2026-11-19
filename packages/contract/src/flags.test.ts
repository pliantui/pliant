import { describe, expect, it } from "vitest"

import { flagsSchema } from "./flags"

describe("flagsSchema", () => {
  it.each([
    {},
    { primary: true },
    { primary: false },
    { primary: true, critical: true, pinned: true, locked: true },
    { primary: false, destructive: true },
    { primary: true, destructive: false },
    { destructive: true, critical: true },
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

  it("rejects an action that is both primary and destructive", () => {
    const result = flagsSchema.safeParse({ primary: true, destructive: true })
    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["primary"],
        message: "An action can't be both primary and destructive",
      }),
    ])
  })
})
