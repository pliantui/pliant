import { describe, expect, it } from "vitest"

import { validateOverlay } from "./validate-overlay"

function overlay(ops: unknown[]) {
  return {
    v: 1,
    id: "01JBQ3V8Z7XKQ2M4N5P6R7S8T9",
    surface: "/orders/[id]",
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "ai",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  }
}

describe("validateOverlay", () => {
  it("returns every op when all are valid", () => {
    const result = validateOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setDensity", target: "@surface", density: "compact" },
      ])
    )
    expect(result.success && result.data.ops.map(({ op }) => op)).toEqual([
      "hide",
      "setDensity",
    ])
  })

  it("rejects the whole overlay when any op fails, with paths into ops", () => {
    const result = validateOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setTheme", target: "orders-table" },
        { op: "hide", target: "orders-table/columns/notes", at: "sm" },
        { op: "rename", target: "orders-table/columns/notes", label: "" },
      ])
    )
    expect(
      result.success ||
        result.error.issues.map(({ path, message }) => ({ path, message }))
    ).toEqual([
      { path: ["ops", 1, "op"], message: "Unknown op setTheme" },
      {
        path: ["ops", 2, "op"],
        message: "hide has arguments this version doesn't support",
      },
      {
        path: ["ops", 3, "label"],
        message: "Too small: expected string to have >=1 characters",
      },
    ])
  })

  it("fails when the envelope is invalid", () => {
    expect(validateOverlay({ ...overlay([]), v: 2 }).success).toBe(false)
  })
})
