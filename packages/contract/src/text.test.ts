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
  ])("rejects %j with Zod's own too_big issue", (value) => {
    expect(schema.safeParse(value).error?.issues).toEqual([
      expect.objectContaining({
        code: "too_big",
        origin: "string",
        maximum: 2,
        inclusive: true,
        path: [],
      }),
    ])
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
