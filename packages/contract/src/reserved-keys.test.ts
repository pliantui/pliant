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

  it.each([
    ['{"a":{"prototype":1},"b":{"constructor":1}}', ["a", "prototype"]],
    ['{"a":{"b":{"prototype":1},"constructor":1}}', ["a", "b", "prototype"]],
  ])("reports the first reserved key in key order in %s", (json, path) => {
    const issues = schema.safeParse(JSON.parse(json)).error?.issues
    expect(issues).toHaveLength(1)
    expect(issues?.[0]?.path).toEqual(path)
  })

  it("walks deeply nested input in linear time", () => {
    let json = '{"x":1}'
    for (let depth = 0; depth < 400_000; depth++) {
      json = `{"a":${json}}`
    }
    const value: unknown = JSON.parse(json)
    const start = performance.now()
    expect(schema.safeParse(value).success).toBe(true)
    expect(performance.now() - start).toBeLessThan(2000)
  })

  it("finds a deeply nested reserved key in linear time", () => {
    let json = '{"__proto__":1}'
    for (let depth = 0; depth < 400_000; depth++) {
      json = `{"a":${json}}`
    }
    const value: unknown = JSON.parse(json)
    const start = performance.now()
    const path = schema.safeParse(value).error?.issues[0]?.path
    expect(performance.now() - start).toBeLessThan(2000)
    expect(path).toHaveLength(400_001)
  })

  it("walks arrays by index, even with an own entries property", () => {
    const items: unknown[] = [{ ok: 1 }, JSON.parse('{"prototype":1}')]
    Object.assign(items, { entries: 1 })
    expect(schema.safeParse({ items }).error?.issues[0]?.path).toEqual([
      "items",
      1,
      "prototype",
    ])
  })
})
