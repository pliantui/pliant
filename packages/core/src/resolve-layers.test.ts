import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"

const scopes: Record<Layer, object> = {
  org: { scope: { org: "acme" } },
  team: { scope: { team: "sales" } },
  personal: {},
  session: {},
}

function overlays() {
  let count = 0
  return (layer: Layer, ops: unknown[]) => {
    count++
    return overlayWith(
      `01JBQ3V8Z7XKQ2M4N5P6R7S8${String(count).padStart(2, "0")}`,
      layer,
      ops
    )
  }
}

function overlayWith(id: string, layer: Layer, ops: unknown[]): LoadedOverlay {
  const result = loadOverlay({
    v: 1,
    id,
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
    expect(resolveLayers([])).toEqual({ properties: new Map(), skipped: [] })
  })

  it("lets the higher layer win, whatever order overlays are given in", () => {
    const overlay = overlays()
    const session = overlay("session", [show])
    const org = overlay("org", [hide])
    const personal = overlay("personal", [hide])
    const team = overlay("team", [show])

    const visible = (input: LoadedOverlay[]) =>
      resolveLayers(input).properties.get(notes)?.get("visible")

    const resolved = visible([session, org, personal, team])
    expect(resolved?.winner.overlay).toBe(session)
    expect(resolved?.winner.check).toBe(session.ops[0])
    const expected = [org, team, personal]
    expect(resolved?.overridden).toHaveLength(3)
    resolved?.overridden.forEach(({ overlay }, index) => {
      expect(overlay).toBe(expected[index])
    })
    expect(visible([personal, team, org])?.winner.overlay).toBe(personal)
    expect(visible([team, org])?.winner.overlay).toBe(team)
    expect(visible([org])?.overridden).toEqual([])
  })

  it("applies overlays in a layer in the order given", () => {
    const overlay = overlays()
    const first = overlay("personal", [hide])
    const second = overlay("personal", [show])
    const visible = (input: LoadedOverlay[]) =>
      resolveLayers(input).properties.get(notes)?.get("visible")

    expect(visible([first, second])?.winner.overlay).toBe(second)
    expect(visible([first, second])?.overridden[0]?.overlay).toBe(first)
    expect(visible([second, first])?.winner.overlay).toBe(first)
  })

  it("lets a later op in an overlay win", () => {
    const overlay = overlays()
    const personal = overlay("personal", [hide, show])
    const resolved = resolveLayers([personal]).properties.get(notes)

    expect(resolved?.get("visible")?.winner.check).toBe(personal.ops[1])
    expect(resolved?.get("visible")?.overridden[0]?.check).toBe(personal.ops[0])
  })

  it("keeps different properties independent", () => {
    const overlay = overlays()
    const team = overlay("team", [
      { op: "move", target: "dashboard/slots/x", to: { after: "y" } },
      { op: "setLayout", target: "dashboard", mode: "grid", columns: 3 },
    ])
    const personal = overlay("personal", [
      { op: "hide", target: "dashboard/slots/y" },
      { op: "setLayout", target: "dashboard", mode: "stack", at: "sm" },
    ])
    const { properties } = resolveLayers([team, personal])
    const layer = (address: string, property: OpPropertyKey) =>
      get(properties, property, address)

    expect(layer("dashboard/slots/x", "position")).toBe("team")
    expect(layer("dashboard/slots/y", "visible")).toBe("personal")
    expect(layer("dashboard", "layout.md")).toBe("team")
    expect(layer("dashboard", "layout.sm")).toBe("personal")
  })

  it("treats a layout without a breakpoint as md", () => {
    const overlay = overlays()
    const team = overlay("team", [
      { op: "setLayout", target: "dashboard", mode: "grid", at: "md" },
    ])
    const personal = overlay("personal", [
      { op: "setLayout", target: "dashboard", mode: "row" },
    ])

    expect(
      get(resolveLayers([team, personal]).properties, "layout.md", "dashboard")
    ).toBe("personal")
  })

  it("skips ops that aren't valid and lists them in precedence order", () => {
    const overlay = overlays()
    const personal = overlay("personal", [
      { op: "show", target: notes, at: "sm" },
      { op: "setTheme", target: notes },
      { op: "rename", target: notes, label: "" },
      { op: "setPage", target: "orders-table", index: 1 },
    ])
    const team = overlay("team", [hide, { op: "setTheme", target: notes }])
    const { properties, skipped } = resolveLayers([personal, team])

    expect(properties.get(notes)?.get("visible")?.winner.overlay).toBe(team)
    expect(properties.get(notes)?.has("label")).toBe(false)
    expect(properties.has("orders-table")).toBe(false)
    expect(
      skipped.map(({ check, overlay }) => [
        overlay.layer,
        check.index,
        check.status,
      ])
    ).toEqual([
      ["team", 1, "unknown"],
      ["personal", 0, "newer"],
      ["personal", 1, "unknown"],
      ["personal", 2, "invalid"],
      ["personal", 3, "invalid"],
    ])
    expect(skipped[1]?.check).toBe(personal.ops[0])
    expect(skipped[1]?.overlay).toBe(personal)
    expect(skipped[0]?.overlay).toBe(team)
  })

  it("resolves many ops on one property in linear time", () => {
    const overlay = overlays()
    const input = Array.from({ length: 40 }, () =>
      overlay(
        "personal",
        Array.from({ length: 500 }, () => hide)
      )
    )
    const start = Date.now()
    const resolved = resolveLayers(input).properties.get(notes)?.get("visible")
    expect(Date.now() - start).toBeLessThan(500)
    expect(resolved?.overridden).toHaveLength(19_999)
  })
})

function get(
  properties: ResolvedLayers["properties"],
  property: OpPropertyKey,
  address: string
) {
  return properties.get(address)?.get(property)?.winner.overlay.layer
}
