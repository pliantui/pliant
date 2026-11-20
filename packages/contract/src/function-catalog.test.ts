import { describe, expect, it } from "vitest"

import { functionCatalog, type FunctionDefinition } from "./function-catalog"
import { functionSignatures } from "./function-signatures"
import { functionNameSchema } from "./identifier"

type Arg = FunctionDefinition["args"][number]

const argKeys = [
  "name",
  "type",
  "optional",
  "default",
  "variadic",
  "constant",
  "range",
  "values",
] as const satisfies readonly (keyof Arg)[]

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
  let returnsNumber = returns === "number"
  if (typeof returns === "object") {
    if ("like" in returns) {
      refersBack(returns.like, "returns")
    } else if ("join" in returns) {
      returnsNumber = true
      for (const name of returns.join) {
        const arg = args.find((candidate) => candidate.name === name)
        if (!arg || arg.variadic || !isNumeric(arg.type)) {
          found.push(`returns joins ${name}, which isn't a fixed number`)
        }
      }
    } else {
      returnsNumber = true
      const arg = args.find(
        (candidate) => candidate.name === returns.integerWhenZero
      )
      if (!arg?.constant || !isNumeric(arg.type)) {
        found.push(
          `returns depends on ${returns.integerWhenZero}, which isn't a constant number`
        )
      }
    }
  }
  if (typeof unit === "object") {
    refersBack(unit.like, "unit")
  } else if (unit !== "none" && !returnsNumber) {
    found.push(`has a ${unit} unit but doesn't return a number`)
  }
  return found
}

describe("functionCatalog", () => {
  it.each(Object.entries(functionCatalog.functions))(
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

  it("reports returns that depend on the wrong arguments", () => {
    const args = [
      { name: "a", type: "string" },
      { name: "b", type: "number", variadic: true },
    ] as const
    const base = {
      kind: "row",
      args,
      unit: "none",
      nulls: "propagate",
      mergeable: null,
      describe: "Broken.",
    } as const
    expect(problems({ ...base, returns: { join: ["a", "b", "c"] } })).toEqual([
      "returns joins a, which isn't a fixed number",
      "returns joins b, which isn't a fixed number",
      "returns joins c, which isn't a fixed number",
    ])
    expect(problems({ ...base, returns: { integerWhenZero: "b" } })).toEqual([
      "returns depends on b, which isn't a constant number",
    ])
  })

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

  it("agrees with functionSignatures", () => {
    const signatures = Object.entries(functionCatalog.functions).map(
      ([name, { kind, args, returns, unit }]) => [
        name,
        { kind, args, returns, unit },
      ]
    )
    expect(Object.fromEntries(signatures)).toEqual(functionSignatures)
    expect(Object.keys(functionSignatures)).toEqual(
      Object.keys(functionCatalog.functions)
    )
  })

  it("states every rule as sentences", () => {
    for (const rule of functionCatalog.rules) {
      expect(rule).toMatch(/^\S.*\.$/)
    }
  })

  it("publishes every argument key", () => {
    for (const { args } of Object.values(functionCatalog.functions)) {
      for (const arg of args) {
        expect(argKeys).toEqual(expect.arrayContaining(Object.keys(arg)))
      }
    }
  })

  it("matches the published file", async () => {
    const functions = Object.fromEntries(
      Object.entries(functionCatalog.functions).map(([name, definition]) => [
        name,
        {
          kind: definition.kind,
          args: definition.args.map((arg) =>
            Object.fromEntries(argKeys.map((key) => [key, arg[key]]))
          ),
          returns: definition.returns,
          unit: definition.unit,
          nulls: definition.nulls,
          mergeable: definition.mergeable,
          describe: definition.describe,
        },
      ])
    )
    await expect(
      `${JSON.stringify(
        { contract: 1, rules: functionCatalog.rules, functions },
        null,
        2
      )}\n`
    ).toMatchFileSnapshot("../schema/functions.json")
  })
})
