import { describe, expect, it } from "vitest"

import { functionCatalog, type FunctionDefinition } from "./function-catalog"
import { functionNameSchema } from "./identifier"

const entries = Object.entries(functionCatalog)

function argProblems({ args, returns }: FunctionDefinition): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  args.forEach((arg, index) => {
    const isLast = index === args.length - 1
    if (seen.has(arg.name)) {
      problems.push(`${arg.name} is repeated`)
    }
    if (typeof arg.type === "object" && "like" in arg.type) {
      if (!seen.has(arg.type.like)) {
        problems.push(`${arg.name} is like an argument that isn't before it`)
      }
    } else if (Array.isArray(arg.type) && arg.type.length < 2) {
      problems.push(`${arg.name} lists fewer than 2 types`)
    }
    if (arg.variadic && !isLast) {
      problems.push(`${arg.name} is variadic but not last`)
    }
    if (arg.optional && args.slice(index + 1).some((next) => !next.optional)) {
      problems.push(`${arg.name} is optional before a required argument`)
    }
    if (arg.values && (arg.type !== "string" || arg.values.length === 0)) {
      problems.push(`${arg.name} lists values but isn't a string`)
    }
    seen.add(arg.name)
  })
  if (args.some((arg) => arg.variadic) && args.some((arg) => arg.optional)) {
    problems.push("has both optional and variadic arguments")
  }
  if (typeof returns === "object" && !seen.has(returns.like)) {
    problems.push("returns the type of an unknown argument")
  }
  return problems
}

describe("functionCatalog", () => {
  it.each(entries)("%s is well-formed", (name, definition) => {
    expect(functionNameSchema.safeParse(name).success).toBe(true)
    expect(argProblems(definition)).toEqual([])
    expect(definition.args.length).toBeLessThanOrEqual(16)
    expect(definition.describe).toMatch(/^\S.*\.$/)
    if (definition.kind === "row") {
      expect(definition.nulls).not.toBe("skip")
      expect(definition.mergeable).toBeNull()
    } else {
      expect(definition.nulls).not.toBe("propagate")
    }
    if (definition.kind === "window") {
      expect(definition.mergeable).toBeNull()
    }
    if (definition.mergeable) {
      expect(new Set(definition.mergeable).size).toBe(
        definition.mergeable.length
      )
    }
  })

  it("merges every mean with a count", () => {
    for (const { mergeable } of Object.values(functionCatalog)) {
      if (mergeable?.includes("mean") || mergeable?.includes("m2")) {
        expect(mergeable).toContain("count")
        expect(mergeable).toContain("mean")
      }
    }
  })

  it("reports problems in a malformed definition", () => {
    expect(
      argProblems({
        kind: "row",
        args: [
          { name: "a", type: { like: "b" }, optional: true },
          { name: "b", type: ["number"], variadic: true },
          { name: "b", type: "number", values: ["x"] },
        ],
        returns: { like: "c" },
        nulls: "propagate",
        mergeable: null,
        sql: true,
        describe: "Broken.",
      })
    ).toEqual([
      "a is like an argument that isn't before it",
      "a is optional before a required argument",
      "b lists fewer than 2 types",
      "b is variadic but not last",
      "b is repeated",
      "b lists values but isn't a string",
      "has both optional and variadic arguments",
      "returns the type of an unknown argument",
    ])
  })

  it("matches the published file", async () => {
    await expect(
      `${JSON.stringify({ contract: 1, functions: functionCatalog }, null, 2)}\n`
    ).toMatchFileSnapshot("../schema/functions.json")
  })
})
