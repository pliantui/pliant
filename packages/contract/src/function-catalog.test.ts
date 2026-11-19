import { describe, expect, it } from "vitest"

import {
  functionCatalog,
  functionRules,
  type FunctionDefinition,
} from "./function-catalog"
import { functionNameSchema } from "./identifier"

type Arg = FunctionDefinition["args"][number]

function isNumeric(type: Arg["type"]) {
  return type === "number" || type === "integer"
}

function defaultProblem(arg: Arg): string | undefined {
  if (arg.default === undefined) {
    return undefined
  }
  if (!arg.optional) {
    return `${arg.name} has a default but isn't optional`
  }
  if (arg.values) {
    return typeof arg.default === "string" && arg.values.includes(arg.default)
      ? undefined
      : `${arg.name} has a default outside its values`
  }
  if (typeof arg.default !== "number" || !isNumeric(arg.type)) {
    return `${arg.name} has a default of the wrong type`
  }
  if (arg.range && (arg.default < arg.range[0] || arg.default > arg.range[1])) {
    return `${arg.name} has a default outside its range`
  }
  return undefined
}

function problems({ args, returns, unit }: FunctionDefinition): string[] {
  const found: string[] = []
  const linkable = new Set<string>()
  const names = new Set<string>()
  const refersBack = (like: string, what: string) => {
    if (!linkable.has(like)) {
      found.push(
        `${what} is like ${like}, which isn't an earlier fixed argument`
      )
    }
  }
  args.forEach((arg, index) => {
    if (names.has(arg.name)) {
      found.push(`${arg.name} is repeated`)
    }
    if (typeof arg.type === "object" && "like" in arg.type) {
      refersBack(arg.type.like, arg.name)
    } else if (Array.isArray(arg.type) && arg.type.length < 2) {
      found.push(`${arg.name} lists fewer than 2 types`)
    }
    if (arg.variadic && index !== args.length - 1) {
      found.push(`${arg.name} is variadic but not last`)
    }
    if (arg.optional && args.slice(index + 1).some((next) => !next.optional)) {
      found.push(`${arg.name} is optional before a required argument`)
    }
    if (arg.values) {
      if (arg.type !== "string") {
        found.push(`${arg.name} lists values but isn't a string`)
      }
      if (
        arg.values.length === 0 ||
        new Set(arg.values).size !== arg.values.length ||
        arg.values.includes("")
      ) {
        found.push(`${arg.name} has empty or repeated values`)
      }
    }
    if (
      arg.range &&
      (!arg.constant || !isNumeric(arg.type) || arg.range[0] > arg.range[1])
    ) {
      found.push(`${arg.name} has a range but isn't a constant number`)
    }
    const problem = defaultProblem(arg)
    if (problem) {
      found.push(problem)
    }
    names.add(arg.name)
    if (!arg.variadic) {
      linkable.add(arg.name)
    }
  })
  if (args.some((arg) => arg.variadic) && args.some((arg) => arg.optional)) {
    found.push("has both optional and variadic arguments")
  }
  if (typeof returns === "object") {
    refersBack(returns.like, "returns")
  }
  if (typeof unit === "object") {
    refersBack(unit.like, "unit")
  } else if (unit !== "none" && returns !== "number") {
    found.push(`has a ${unit} unit but doesn't return a number`)
  }
  return found
}

describe("functionCatalog", () => {
  it.each(Object.entries(functionCatalog))(
    "%s is well-formed",
    (name, definition) => {
      expect(functionNameSchema.safeParse(name).success).toBe(true)
      expect(problems(definition)).toEqual([])
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
      const { mergeable } = definition
      if (mergeable) {
        expect(new Set(mergeable).size).toBe(mergeable.length)
        if (mergeable.includes("mean") || mergeable.includes("m2")) {
          expect(mergeable).toContain("count")
          expect(mergeable).toContain("mean")
        }
      }
    }
  )

  it("reports every problem in a malformed definition", () => {
    expect(
      problems({
        kind: "row",
        args: [
          { name: "a", type: { like: "v" }, optional: true, default: 1 },
          { name: "v", type: ["number"], variadic: true },
          { name: "w", type: "number", values: ["x", "x"], default: "x" },
          { name: "c", type: { like: "v" }, range: [1, 0] },
          { name: "a", type: "number" },
        ],
        returns: { like: "d" },
        unit: "percent",
        nulls: "propagate",
        mergeable: null,
        describe: "Broken.",
      })
    ).toEqual([
      "a is like v, which isn't an earlier fixed argument",
      "a is optional before a required argument",
      "a has a default of the wrong type",
      "v lists fewer than 2 types",
      "v is variadic but not last",
      "w lists values but isn't a string",
      "w has empty or repeated values",
      "w has a default but isn't optional",
      "c is like v, which isn't an earlier fixed argument",
      "c has a range but isn't a constant number",
      "a is repeated",
      "has both optional and variadic arguments",
      "returns is like d, which isn't an earlier fixed argument",
      "has a percent unit but doesn't return a number",
    ])
  })

  it("matches the published file", async () => {
    await expect(
      `${JSON.stringify(
        { contract: 1, rules: functionRules, functions: functionCatalog },
        null,
        2
      )}\n`
    ).toMatchFileSnapshot("../schema/functions.json")
  })
})
