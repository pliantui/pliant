import { describe, expect, it } from "vitest"

import { checkOp } from "./check-op"

function check(op: unknown) {
  return checkOp(op, 0)
}

describe("checkOp", () => {
  it("returns the parsed op when it is valid", () => {
    expect(
      check({ op: "setDensity", target: "@surface", density: "compact" })
    ).toEqual({
      index: 0,
      status: "valid",
      op: { op: "setDensity", target: "@surface", density: "compact" },
    })
  })

  it.each(["setTheme", "toString", "constructor", "hasOwnProperty", "valueOf"])(
    "treats %s as unknown",
    (name) => {
      expect(check({ op: name, target: "orders-table" }).status).toBe("unknown")
    }
  )

  it.each([
    [{ op: "hide", target: "orders-table/columns/notes", at: "sm" }, ["at"]],
    [
      { op: "setPresentation", target: "edit-order", as: "sheet", width: 2 },
      ["width"],
    ],
    [
      { op: "setLayout", target: "dashboard", mode: "row", gap: 2, wrap: true },
      ["gap", "wrap"],
    ],
  ])("treats unknown top-level arguments as newer: %j", (op, keys) => {
    expect(check(op)).toEqual({ index: 0, status: "newer", op, keys })
  })

  it.each([
    { op: "setPresentation", target: "edit-order", as: "dialog", side: "left" },
    { op: "setLayout", target: "dashboard", mode: "row", columns: 2 },
    {
      op: "wrap",
      target: "dashboard",
      id: "row",
      items: ["a", "b"],
      mode: "stack",
      columns: 2,
    },
    { op: "pin", target: "orders-table/columns/id", where: "top", at: "sm" },
    { op: "move", target: "dashboard/slots/a", to: { before: "b", gap: 1 } },
    {
      op: "addDerived",
      target: "orders-table",
      id: "x",
      label: "X",
      expr: { field: "a", cast: "int" },
    },
    {
      op: "configureStat",
      target: "revenue-stat",
      metric: "total",
      comparison: { metric: "last", display: "percent", baseline: 1 },
    },
    { op: "setPresentation", target: "edit-order", as: "popover" },
    { op: "rename", target: "orders-table/columns/notes", label: "" },
  ])("treats %j as invalid, with its error", (op) => {
    const result = check(op)
    expect(result.status).toBe("invalid")
    expect(
      result.status === "invalid" && result.error.issues.length
    ).toBeGreaterThan(0)
  })

  it("keeps the original op for ops it can't apply", () => {
    const op = { op: "hide", target: "orders-table/columns/notes", at: "sm" }
    expect(check(op).op).toStrictEqual(op)
  })

  it.each([
    null,
    "hide",
    5,
    [],
    { target: "orders-table" },
    { op: "Hide", target: "x" },
  ])("treats %j as invalid, keeping it unchanged", (op) => {
    const result = check(op)
    expect(result.status).toBe("invalid")
    expect(result.op).toBe(op)
  })

  it.each([
    [
      { layer: "personal" as const },
      { op: "setPage", target: "orders-table", index: 1 },
      ["op"],
    ],
    [
      { surface: "/orders" },
      { op: "setTextScale", target: "@app", scale: 1.25 },
      ["target"],
    ],
    [{ surface: "@app" }, { op: "hide", target: "orders-table" }, ["target"]],
  ])("applies the overlay's %j to %j", (context, op, path) => {
    const result = checkOp(op, 0, context)
    expect(
      result.status === "invalid" &&
        result.error.issues.map((issue) => issue.path)
    ).toEqual([path])
  })

  it("doesn't treat an op that breaks a layer rule as newer", () => {
    const result = checkOp(
      { op: "setPage", target: "orders-table", index: 1, cursor: "x" },
      0,
      { layer: "personal" }
    )
    expect(result.status).toBe("invalid")
  })

  it("accepts ops in their allowed layer and on the right surface", () => {
    expect(
      checkOp({ op: "setPage", target: "orders-table", index: 1 }, 0, {
        layer: "session",
        surface: "/orders",
      }).status
    ).toBe("valid")
    expect(
      checkOp({ op: "setTextScale", target: "@app", scale: 1.25 }, 0, {
        layer: "personal",
        surface: "@app",
      }).status
    ).toBe("valid")
  })
})
