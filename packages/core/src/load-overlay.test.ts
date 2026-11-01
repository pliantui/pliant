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
  it("returns the overlay with a check for each op, in order", () => {
    const result = loadOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setTheme", target: "orders-table", theme: "ocean" },
        { op: "hide", target: "orders-table/columns/notes", at: "sm" },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ])
    )
    expect(
      result.data?.ops.map(({ index, status }) => [index, status])
    ).toEqual([
      [0, "valid"],
      [1, "unknown"],
      [2, "newer"],
      [3, "invalid"],
    ])
    expect(result.data?.surface).toBe("/orders/[id]")
  })

  it("fails when the envelope is invalid", () => {
    const result = loadOverlay({ ...overlay([]), v: 2 })
    expect(result.success).toBe(false)
    expect(result.error?.issues.length).toBeGreaterThan(0)
  })
})
