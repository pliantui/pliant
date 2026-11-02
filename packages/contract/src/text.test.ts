import { describe, expect, it } from "vitest"

import { textSchema } from "./text"

describe("textSchema", () => {
  const schema = textSchema(2)

  it.each(["", "ab", "\u{1F600}\u{1F600}", "a\u{1F600}", "\uD800\uD800"])(
    "accepts %j, at most 2 code points",
    (value) => {
      expect(schema.safeParse(value).success).toBe(true)
    }
  )

  it.each(["abc", "\u{1F600}\u{1F600}\u{1F600}", "\uD800\uD800\uD800"])(
    "rejects %j, over 2 code points",
    (value) => {
      expect(schema.safeParse(value).error?.issues[0]?.message).toBe(
        "Too big: expected string to have <=2 characters"
      )
    }
  )
})
