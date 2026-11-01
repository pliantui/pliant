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
  it("returns the overlay with parsed ops when every op is valid", () => {
    const result = validateOverlay(
      overlay([
        { op: "hide", target: "orders-table/columns/notes" },
        { op: "setDensity", target: "@surface", density: "compact" },
      ])
    )
    expect(result.data?.ops.map(({ op }) => op)).toEqual(["hide", "setDensity"])
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
      result.error?.issues.map(({ code, path, message }) => ({
        code,
        path,
        message,
      }))
    ).toEqual([
      {
        code: "custom",
        path: ["ops", 1, "op"],
        message: "Unknown op setTheme",
      },
      {
        code: "unrecognized_keys",
        path: ["ops", 2],
        message: 'Unrecognized key: "at"',
      },
      {
        code: "too_small",
        path: ["ops", 3, "label"],
        message: "Too small: expected string to have >=1 characters",
      },
    ])
  })

  it("doesn't copy op input into issues", () => {
    const result = validateOverlay(
      overlay([{ op: "setTheme", target: "orders-table", secret: "x" }])
    )
    expect(result.error?.issues[0]).not.toHaveProperty("input")
  })

  it("fails when the envelope is invalid", () => {
    expect(validateOverlay({ ...overlay([]), v: 2 }).success).toBe(false)
  })
})
