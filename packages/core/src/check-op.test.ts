import { describe, expect, it } from "vitest"

import type { OverlayOp } from "@pliantui/contract"
import { opCatalog } from "@pliantui/contract"

import { checkOp, opBranches } from "./check-op"

function check(op: OverlayOp) {
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
    [
      {
        op: "setPresentation",
        target: "edit-order",
        as: "dialog",
        side: "left",
      },
      ["side"],
    ],
    [
      { op: "setLayout", target: "dashboard", mode: "row", columns: 2 },
      ["columns"],
    ],
    [
      {
        op: "wrap",
        target: "dashboard",
        id: "row",
        items: ["a", "b"],
        mode: "stack",
        columns: 2,
      },
      ["columns"],
    ],
  ])("treats unknown top-level arguments as newer: %j", (op, keys) => {
    expect(check(op)).toEqual({ index: 0, status: "newer", op, keys })
  })

  it.each([
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
    expect(check(op).op).toBe(op)
  })

  it("knows the arguments of every op in the catalog", () => {
    expect([...opBranches.keys()].sort()).toEqual(Object.keys(opCatalog).sort())
    for (const [name, branches] of opBranches) {
      expect(branches.length, name).toBeGreaterThan(0)
      for (const { keys } of branches) {
        expect([...keys], name).toEqual(
          expect.arrayContaining(["op", "target"])
        )
      }
    }
  })
})
