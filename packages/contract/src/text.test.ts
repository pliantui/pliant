import { describe, expect, it } from "vitest"
import * as z from "zod"

import { textSchema } from "./text"

describe("textSchema", () => {
  const schema = textSchema(2)

  it.each([
    "",
    "ab",
    "\u{1F600}\u{1F600}",
    "a\u{1F600}",
    "\uD800\uD800",
    "a\uD83D",
    "\uDC00\uDC00",
  ])("accepts %j, at most 2 code points", (value) => {
    expect(schema.safeParse(value).success).toBe(true)
  })

  it.each([
    "abc",
    "\u{1F600}\u{1F600}\u{1F600}",
    "a\u{1F600}b",
    "\uD800\uD800\uD800",
    "\uDC00\uDC00\uDC00",
  ])("rejects %j with the same issue as Zod's own max", (value) => {
    expect(schema.safeParse(value).error?.issues).toEqual(
      z.string().max(2).safeParse(value).error?.issues
    )
  })

  it("reports the same localized message as Zod's own max", () => {
    z.config(z.locales.de())
    try {
      expect(schema.safeParse("abc").error?.issues).toEqual(
        z.string().max(2).safeParse("abc").error?.issues
      )
    } finally {
      z.config(z.locales.en())
    }
  })

  it("keeps minLength and maxLength in its JSON Schema", () => {
    expect(z.toJSONSchema(textSchema(2, { min: 1 }))).toMatchObject({
      type: "string",
      minLength: 1,
      maxLength: 2,
    })
    expect(z.toJSONSchema(textSchema(2))).not.toHaveProperty("minLength")
  })
})
