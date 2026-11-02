import { describe, expect, it } from "vitest"
import * as z from "zod"

import { withoutReservedKeys } from "./reserved-keys"

const schema = withoutReservedKeys(z.unknown())

describe("withoutReservedKeys", () => {
  it.each([
    ['{"__proto__":{"x":1}}', ["__proto__"]],
    ['{"a":{"b":{"constructor":1}}}', ["a", "b", "constructor"]],
    ['{"a":[{"ok":1},{"prototype":true}]}', ["a", 1, "prototype"]],
    ['[{"basis":{"__proto__":{"layers":"x"}}}]', [0, "basis", "__proto__"]],
  ])("rejects %s before parsing", (json, path) => {
    expect(
      schema
        .safeParse(JSON.parse(json))
        .error?.issues.map(({ code, message, path }) => ({
          code,
          message,
          path,
        }))
    ).toEqual([
      {
        code: "custom",
        message: `Must not have a ${String(path.at(-1))} key`,
        path,
      },
    ])
  })

  it.each([
    { name: "constructor" },
    ["__proto__", "prototype"],
    { a: "constructor" },
    { a: { b: null } },
  ])("accepts reserved words as values: %j", (value) => {
    expect(schema.safeParse(value).success).toBe(true)
  })

  it("stops at objects it has already seen", () => {
    const value: Record<string, unknown> = { a: 1 }
    value["self"] = value
    expect(schema.safeParse(value).success).toBe(true)
  })

  it("stops Zod from parsing the input", () => {
    let parsed = false
    const guarded = withoutReservedKeys(
      z.unknown().refine(() => {
        parsed = true
        return true
      })
    )
    expect(guarded.safeParse(JSON.parse('{"__proto__":{}}')).success).toBe(
      false
    )
    expect(parsed).toBe(false)
  })
})
