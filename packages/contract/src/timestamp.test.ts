import { describe, expect, it } from "vitest"

import { timestampSchema } from "./timestamp"

describe("timestampSchema", () => {
  it.each([
    "2026-11-19T10:15:00Z",
    "2026-11-19T10:15:30.5+05:30",
    "2024-02-29T23:59:59-08:00",
  ])("accepts %s", (value) => {
    expect(timestampSchema.safeParse(value).success).toBe(true)
  })

  it.each([
    "2026-11-19T10:15Z",
    "2026-11-19T10:15+05:30",
    "2026-11-19T10:15",
    "2026-11-19T10:15.5Z",
    "yesterday",
  ])("rejects %s with a single issue", (value) => {
    const result = timestampSchema.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues).toHaveLength(1)
  })
})
