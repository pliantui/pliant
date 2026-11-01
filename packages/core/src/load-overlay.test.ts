import { describe, expect, it } from "vitest"

import { loadOverlay } from "./load-overlay"

function overlay(ops: unknown[]) {
  return {
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
    surface: "/orders/[id]",
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

describe("loadOverlay", () => {
  it("checks each op on its own", () => {
    const result = loadOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setTheme", target: "orders-table", theme: "ocean" },
        { op: "hide", target: "orders-table/columns/notes", at: "sm" },
        { op: "setPresentation", target: "edit-order", as: "sheet", width: 2 },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ])
    )
    expect(
      result.success &&
        result.data.ops.map(({ index, status }) => [index, status])
    ).toEqual([
      [0, "valid"],
      [1, "unknown"],
      [2, "newer"],
      [3, "newer"],
      [4, "invalid"],
    ])
  })

  it("treats unknown arguments with an invalid value as invalid", () => {
    const result = loadOverlay(
      overlay([
        {
          op: "pin",
          target: "orders-table/columns/id",
          where: "top",
          at: "sm",
        },
      ])
    )
    expect(result.success && result.data.ops[0]?.status).toBe("invalid")
  })

  it("returns the parsed op for valid ops", () => {
    const result = loadOverlay(
      overlay([{ op: "setDensity", target: "@surface", density: "compact" }])
    )
    expect(result.success && result.data.ops[0]).toEqual({
      index: 0,
      status: "valid",
      op: { op: "setDensity", target: "@surface", density: "compact" },
    })
  })

  it("fails when the envelope is invalid", () => {
    const result = loadOverlay({ ...overlay([]), v: 2 })
    expect(result.success).toBe(false)
  })
})
