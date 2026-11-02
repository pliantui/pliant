import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers } from "./resolve-layers"

const scopes: Record<Layer, object> = {
  org: { scope: { org: "acme" } },
  team: { scope: { team: "sales" } },
  personal: {},
  session: {},
}

let count = 0

function overlay(layer: Layer, ops: unknown[]): LoadedOverlay {
  count++
  const result = loadOverlay({
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6R7S8${String(count).padStart(2, "0")}`,
    surface: "/orders/[id]",
    layer,
    ...scopes[layer],
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  })
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const notes = "orders-table/columns/notes"
const hide = { op: "hide", target: notes }
const show = { op: "show", target: notes }

describe("resolveLayers", () => {
  it("returns nothing for no overlays", () => {
    expect(resolveLayers([])).toEqual({ ops: new Map(), skipped: [] })
  })

  it("lets the higher layer win, whatever order overlays are given in", () => {
    const session = overlay("session", [show])
    const org = overlay("org", [hide])
    const personal = overlay("personal", [hide])
    const team = overlay("team", [show])

    const winner = (overlays: LoadedOverlay[]) =>
      resolveLayers(overlays).ops.get(notes)?.get("visible")

    expect(winner([session, org, personal, team])).toEqual({
      op: show,
      index: 0,
      layer: "session",
      overlay: session,
    })
    expect(winner([personal, team, org])?.overlay).toBe(personal)
    expect(winner([team, org])?.overlay).toBe(team)
    expect(winner([org])?.layer).toBe("org")
  })

  it("applies overlays in a layer in the order given", () => {
    const first = overlay("personal", [hide])
    const second = overlay("personal", [show])

    expect(
      resolveLayers([first, second]).ops.get(notes)?.get("visible")?.overlay
    ).toBe(second)
    expect(
      resolveLayers([second, first]).ops.get(notes)?.get("visible")?.overlay
    ).toBe(first)
  })

  it("lets a later op in an overlay win", () => {
    const resolved = resolveLayers([overlay("personal", [hide, show])]).ops.get(
      notes
    )

    expect(resolved?.get("visible")).toMatchObject({ op: show, index: 1 })
  })

  it("keeps different properties independent", () => {
    const team = overlay("team", [
      { op: "move", target: "dashboard/slots/x", to: { after: "y" } },
      { op: "setLayout", target: "dashboard", mode: "grid", columns: 3 },
    ])
    const personal = overlay("personal", [
      { op: "hide", target: "dashboard/slots/y" },
      { op: "setLayout", target: "dashboard", mode: "stack", at: "sm" },
    ])
    const { ops } = resolveLayers([team, personal])

    expect(ops.get("dashboard/slots/x")?.get("position")?.layer).toBe("team")
    expect(ops.get("dashboard/slots/y")?.get("visible")?.layer).toBe("personal")
    expect(ops.get("dashboard")?.get("layout.md")?.layer).toBe("team")
    expect(ops.get("dashboard")?.get("layout.sm")?.layer).toBe("personal")
  })

  it("treats a layout without a breakpoint as md", () => {
    const team = overlay("team", [
      { op: "setLayout", target: "dashboard", mode: "grid", at: "md" },
    ])
    const personal = overlay("personal", [
      { op: "setLayout", target: "dashboard", mode: "row" },
    ])

    expect(
      resolveLayers([team, personal]).ops.get("dashboard")?.get("layout.md")
        ?.layer
    ).toBe("personal")
  })

  it("skips ops that aren't valid and lists them", () => {
    const team = overlay("team", [hide])
    const personal = overlay("personal", [
      { op: "show", target: notes, at: "sm" },
      { op: "setTheme", target: notes },
      { op: "rename", target: notes, label: "" },
      { op: "setPage", target: "orders-table", index: 1 },
    ])
    const { ops, skipped } = resolveLayers([personal, team])

    expect(ops.get(notes)?.get("visible")?.overlay).toBe(team)
    expect(ops.get(notes)?.has("label")).toBe(false)
    expect(ops.has("orders-table")).toBe(false)
    expect(skipped.map(({ check }) => [check.index, check.status])).toEqual([
      [0, "newer"],
      [1, "unknown"],
      [2, "invalid"],
      [3, "invalid"],
    ])
    expect(skipped.every(({ overlay }) => overlay === personal)).toBe(true)
    expect(skipped[0]?.check).toBe(personal.ops[0])
  })
})
