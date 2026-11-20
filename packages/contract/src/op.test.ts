import { describe, expect, it } from "vitest"
import * as z from "zod"

import { readOpFixtures } from "../test/fixtures"
import { expectCrossFieldIssue } from "../test/fixtures/cross-field"
import { opSchema } from "./op"
import { opCatalog } from "./op-catalog"

const fixtures = readOpFixtures()

const physical = /left|right/i

function get(node: unknown, ...keys: string[]): unknown {
  return keys.reduce<unknown>(
    (value, key) =>
      typeof value === "object" && value !== null
        ? Reflect.get(value, key)
        : undefined,
    node
  )
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function* schemaObjects(node: unknown): Generator<object> {
  if (typeof node !== "object" || node === null) {
    return
  }
  if (!Array.isArray(node)) {
    yield node
  }
  for (const value of Object.values(node)) {
    yield* schemaObjects(value)
  }
}

// Shortcut keys such as arrowleft are physical keys by design, so the one
// pattern that may mention left or right is bindShortcut's keys.
function shortcutKeys(nodes: object[]) {
  return get(
    nodes.find(
      (node) => get(node, "properties", "op", "const") === "bindShortcut"
    ),
    "properties",
    "keys"
  )
}

function physicalDirections(schema: unknown) {
  const nodes = [...schemaObjects(schema)]
  const exempt = shortcutKeys(nodes)
  return nodes.flatMap((node) => {
    const properties = get(node, "properties")
    const pattern = get(node, "pattern")
    const found = [
      get(node, "const"),
      ...list(get(node, "enum")),
      ...(typeof properties === "object" && properties !== null
        ? Object.keys(properties)
        : []),
    ].filter(
      (value) => typeof value === "string" && /^(?:left|right)$/i.test(value)
    )
    if (
      typeof pattern === "string" &&
      physical.test(pattern) &&
      node !== exempt
    ) {
      found.push(pattern)
    }
    return found
  })
}

describe("opSchema", () => {
  it("has a fixture for every op in the catalog, and no others", () => {
    expect([...fixtures.keys()].sort()).toEqual(Object.keys(opCatalog).sort())
  })

  describe.each([...fixtures])("%s", (name, fixture) => {
    it.each(fixture.valid)("accepts %j", (op) => {
      expect(opSchema.parse(op)).toMatchObject({ op: name })
    })

    it.each(fixture.invalid)("rejects %j", (op) => {
      expect(opSchema.safeParse(op).success).toBe(false)
    })

    it.each(fixture.crossField)("reports $message for $value", (entry) => {
      expectCrossFieldIssue(opSchema, entry)
    })
  })

  // Directions are logical (start and end) so overlays work in right-to-left
  // apps. Allowed values, property names and patterns can't name left or
  // right, except the shortcut key pattern.
  it("allows no physical left or right direction in any op", () => {
    const schema = z.toJSONSchema(opSchema, { io: "input" })
    expect(get(shortcutKeys([...schemaObjects(schema)]), "pattern")).toMatch(
      physical
    )
    expect(physicalDirections(schema)).toEqual([])
  })

  it("rejects a deeply nested expression without throwing", () => {
    let expr: unknown = { field: "value" }
    for (let depth = 0; depth < 5000; depth++) {
      expr = { fn: "abs", args: [expr] }
    }
    expect(
      opSchema.safeParse({
        op: "addDerived",
        target: "orders-table",
        id: "deep",
        label: "Deep",
        expr,
      }).success
    ).toBe(false)
  })

  const sizeIssue = {
    code: "custom",
    message: "Must have at most 128 nodes and 16 arguments per function",
    path: ["expr"],
  }

  function addDerived(expr: unknown) {
    return {
      op: "addDerived",
      target: "orders-table",
      id: "big",
      label: "Big",
      expr,
    }
  }

  function tree(depth: number): unknown {
    return depth === 0
      ? { field: "1bad" }
      : { fn: "sum", args: Array.from({ length: 16 }, () => tree(depth - 1)) }
  }

  it.each([
    ["a wide tree", tree(4)],
    [
      "a function with 17 arguments",
      { fn: "sum", args: Array.from({ length: 17 }, () => ({ field: "a" })) },
    ],
    [
      "a very long argument list",
      {
        fn: "sum",
        args: Array.from({ length: 100_000 }, () => ({ field: "a" })),
      },
    ],
  ])("rejects %s with only the size issue", (_, expr) => {
    const result = opSchema.safeParse(addDerived(expr))
    expect(
      result.error?.issues.map(({ code, message, path }) => ({
        code,
        message,
        path,
      }))
    ).toEqual([sizeIssue])
  })

  it.each([
    [
      "a reserved view kind",
      { op: "setViewKind", target: "orders-table", kind: "pliant:Kanban" },
      ["kind"],
    ],
    [
      "a reserved function",
      {
        op: "addDerived",
        target: "orders-table",
        id: "total",
        label: "Total",
        expr: { fn: "pliant:Sum", args: [] },
      },
      ["expr"],
    ],
  ])("reports %s that is also malformed once", (_, op, path) => {
    const issues = opSchema.safeParse(op).error?.issues ?? []
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toEqual(path)
  })

  const removeTargetMessage =
    "Must be a slot address or the id of a node the user added"

  it.each([
    ["a missing remove target", {}, "Invalid input"],
    ["a non-string remove target", { target: 5 }, "Invalid input"],
    [
      "a remove target that is neither a slot nor an id",
      { target: "order-card[]" },
      removeTargetMessage,
    ],
    [
      "a remove target in a template slot",
      { target: "order-card[]/slots/badge" },
      removeTargetMessage,
    ],
  ])("reports %s once", (_, fields, message) => {
    const issues =
      opSchema.safeParse({ op: "remove", ...fields }).error?.issues ?? []
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      code: "invalid_union",
      message,
      path: ["target"],
    })
  })
})
