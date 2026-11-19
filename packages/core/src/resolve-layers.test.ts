import { describe, expect, it, vi } from "vitest"

import type { Layer } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { scopeKeyOf } from "./overlay-scope"
import { applyOp, createResolution, type Resolution } from "./resolution"
import {
  resolveLayers,
  type ResolvedLayers,
  type ResolveLayersOptions,
} from "./resolve-layers"
import { surfaceOrder } from "./surface-order"

interface OverlayOptions {
  id?: string
  surface?: string
  scope?: string
  createdAt?: string
}

const defaultScopes: Record<Layer, string | undefined> = {
  org: "acme",
  team: "sales",
  personal: undefined,
  session: undefined,
}

function overlays() {
  let count = 0
  return (layer: Layer, ops: unknown[], options: OverlayOptions = {}) => {
    count++
    return overlayWith(layer, ops, {
      id: `01JBQ3V8Z7XKQ2M4N5P6R7S8${String(count).padStart(2, "0")}`,
      ...options,
    })
  }
}

function overlayWith(
  layer: Layer,
  ops: unknown[],
  {
    id = "01JBQ3V8Z7XKQ2M4N5P6R7S800",
    scope = defaultScopes[layer],
    createdAt = "2026-11-01T09:30:00.000Z",
    surface: overlaySurface = surface,
  }: OverlayOptions
): LoadedOverlay {
  const result = loadOverlay({
    v: 1,
    id,
    surface: overlaySurface,
    layer,
    ...(layer === "org" && { scope: { org: scope } }),
    ...(layer === "team" && { scope: { team: scope } }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt,
  })
  if (!result.success) {
    throw result.error
  }
  return result.data
}

const surface = "/orders/[id]"

function resolve(
  input: readonly LoadedOverlay[],
  options: Partial<ResolveLayersOptions> = {}
) {
  return resolveLayers(input, { surface, ...options })
}

const ulidDigits = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// Many ops as personal overlays of 500, in order.
function chunked(ops: readonly unknown[]): LoadedOverlay[] {
  return Array.from({ length: Math.ceil(ops.length / 500) }, (_, index) =>
    overlayWith("personal", ops.slice(index * 500, index * 500 + 500), {
      id: `01JBQ3V8Z7XKQ2M4N5P6R7S8${ulidDigits[Math.floor(index / 32)] ?? ""}${ulidDigits[index % 32] ?? ""}`,
    })
  )
}

function permutations<T>(items: readonly T[]): T[][] {
  return items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) =>
        permutations(items.toSpliced(index, 1)).map((rest) => [item, ...rest])
      )
}

function placementAt(placements: ResolvedLayers["placements"], item: string) {
  const placed = placements.get(item)
  return (
    placed && {
      winner: placed.winner,
      overridden: placed.overridden,
      placement: {
        container: placed.container,
        ...(placed.position && { position: placed.position }),
      },
    }
  )
}

function get(
  properties: ResolvedLayers["properties"],
  address: string,
  property: OpPropertyKey
) {
  return properties.get(address)?.get(property)
}

function winner(
  properties: ResolvedLayers["properties"],
  address: string,
  property: OpPropertyKey
) {
  return get(properties, address, property)?.winner.overlay
}

const notes = "orders-table/columns/notes"
const hide = { op: "hide", target: notes }
const show = { op: "show", target: notes }
const table = "orders-table"
const chart = "revenue-chart"
const insertChart = {
  op: "insert",
  target: "dashboard",
  node: { id: "revenue-chart", kind: "chart", dataset: "orders" },
  at: { index: 0 },
}
const removeChart = { op: "remove", target: `dashboard/slots/${chart}` }
const derived = (id: string) => ({
  op: "addDerived",
  target: table,
  id,
  label: "Margin",
  expr: { field: "total" },
})
const preset = (id: string) => ({
  op: "addPreset",
  target: table,
  id,
  label: "Open",
  filters: [{ field: "status", operator: "eq", value: "open" }],
})
const removeItem = (id: string) => ({ op: "removeUserItem", target: table, id })
const wrapOp = (target: string, id: string) => ({
  op: "wrap",
  target,
  id,
  items: ["a", "b"],
  mode: "row",
})
const layout = (mode: string, at?: string) => ({
  op: "setLayout",
  target: "dashboard",
  mode,
  ...(at && { at }),
})

describe("resolveLayers", () => {
  it("returns nothing for no overlays", () => {
    expect(resolve([])).toEqual({
      properties: new Map(),
      placements: new Map(),
      skipped: [],
      unapplied: [],
    })
  })

  it("lets the higher layer win, whatever order overlays are given in", () => {
    const overlay = overlays()
    const session = overlay("session", [show])
    const org = overlay("org", [hide])
    const personal = overlay("personal", [hide])
    const team = overlay("team", [show])

    const visible = (input: LoadedOverlay[]) =>
      get(resolve(input).properties, notes, "visible")

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

  it("lets a later op in an overlay win", () => {
    const overlay = overlays()
    const personal = overlay("personal", [hide, show])
    const resolved = get(resolve([personal]).properties, notes, "visible")

    expect(resolved?.winner.check).toBe(personal.ops[1])
    expect(resolved?.overridden[0]?.check).toBe(personal.ops[0])
  })

  describe("order within a layer", () => {
    const visible = (input: LoadedOverlay[], teamOrder?: string[]) =>
      get(resolve(input, { teamOrder }).properties, notes, "visible")

    it("applies personal overlays by createdAt, then id", () => {
      const overlay = overlays()
      const first = overlay("personal", [hide], {
        createdAt: "2026-11-02T00:00:00.000Z",
      })
      const second = overlay("personal", [show], {
        createdAt: "2026-11-01T23:00:00.000-02:00",
      })
      const sameTimeLowId = overlay("session", [hide], {
        id: "01JBQ3V8Z7XKQ2M4N5P6R7S8A0",
      })
      const sameTimeHighId = overlay("session", [show], {
        id: "01JBQ3V8Z7XKQ2M4N5P6R7S8B0",
      })

      expect(visible([first, second])?.winner.overlay).toBe(second)
      expect(visible([second, first])?.winner.overlay).toBe(second)
      expect(visible([first, second])?.overridden[0]?.overlay).toBe(first)
      expect(visible([sameTimeHighId, sameTimeLowId])?.winner.overlay).toBe(
        sameTimeHighId
      )
      expect(visible([sameTimeLowId, sameTimeHighId])?.winner.overlay).toBe(
        sameTimeHighId
      )
    })

    it("ranks teams by teamOrder, highest precedence first", () => {
      const overlay = overlays()
      const sales = overlay("team", [hide], { scope: "sales" })
      const finance = overlay("team", [show], { scope: "finance" })
      const ops = overlay("team", [hide], { scope: "ops" })
      const all = [sales, finance, ops]

      expect(visible(all, ["sales", "finance"])?.winner.overlay).toBe(sales)
      expect(
        visible(all, ["sales", "finance"])?.overridden.map((op) => op.overlay)
      ).toEqual([ops, finance])
      expect(visible(all, ["finance", "sales"])?.winner.overlay).toBe(finance)
      expect(visible(all.toReversed(), ["ops"])?.winner.overlay).toBe(ops)
    })

    it("ranks unlisted teams by team id, then createdAt", () => {
      const overlay = overlays()
      const sales = overlay("team", [hide], { scope: "sales" })
      const finance = overlay("team", [show], {
        scope: "finance",
        createdAt: "2026-12-01T00:00:00.000Z",
      })
      const laterSales = overlay("team", [show], {
        scope: "sales",
        createdAt: "2026-11-05T00:00:00.000Z",
      })

      expect(visible([sales, finance])?.winner.overlay).toBe(sales)
      expect(visible([finance, sales])?.winner.overlay).toBe(sales)
      expect(
        visible([laterSales, finance, sales])?.overridden.map(
          (op) => op.overlay
        )
      ).toEqual([finance, sales])
      expect(visible([finance, sales], ["finance"])?.winner.overlay).toBe(
        finance
      )
    })

    it("ranks org overlays by org id, then createdAt", () => {
      const overlay = overlays()
      const beta = overlay("org", [hide], { scope: "beta" })
      const alpha = overlay("org", [show], {
        scope: "alpha",
        createdAt: "2027-01-01T00:00:00.000Z",
      })

      expect(visible([beta, alpha])?.winner.overlay).toBe(beta)
      expect(visible([alpha, beta])?.winner.overlay).toBe(beta)
    })
  })

  it("keeps different properties independent", () => {
    const overlay = overlays()
    const team = overlay("team", [
      { op: "move", target: "dashboard/slots/x", to: { after: "y" } },
      { op: "setDensity", target: "@surface", density: "compact" },
    ])
    const personal = overlay("personal", [
      { op: "hide", target: "dashboard/slots/y" },
      layout("stack"),
    ])
    const { properties, placements } = resolve([team, personal])

    expect(placementAt(placements, "x")?.winner?.overlay).toBe(team)
    expect(winner(properties, "y", "visible")).toBe(personal)
    expect(winner(properties, "@surface", "density")).toBe(team)
    expect(winner(properties, "dashboard", "layout")).toBe(personal)
  })

  describe("layout and span", () => {
    it("merges breakpoints within a layer, md when at is missing", () => {
      const overlay = overlays()
      const first = overlay("team", [layout("grid", "lg"), layout("row", "md")])
      const second = overlay("team", [layout("stack")])
      const resolved = get(
        resolve([second, first]).properties,
        "dashboard",
        "layout"
      )

      expect(resolved?.winner.check).toBe(second.ops[0])
      expect([...(resolved?.breakpoints ?? [])]).toEqual([
        ["md", { check: second.ops[0], overlay: second }],
        ["lg", { check: first.ops[0], overlay: first }],
      ])
      expect(resolved?.breakpoints?.get("md")?.check).toBe(second.ops[0])
      expect(resolved?.overridden).toHaveLength(1)
      expect(resolved?.overridden[0]?.check).toBe(first.ops[1])
    })

    it("lets another team replace every breakpoint, like a higher layer", () => {
      const overlay = overlays()
      const sales = overlay("team", [layout("grid", "lg"), layout("row")])
      const support = overlay("team", [layout("stack", "sm")], {
        scope: "support",
      })
      const resolved = get(
        resolve([support, sales]).properties,
        "dashboard",
        "layout"
      )

      expect([...(resolved?.breakpoints ?? [])]).toEqual([
        ["sm", { check: support.ops[0], overlay: support }],
      ])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        sales.ops[0],
        sales.ops[1],
      ])
    })

    it("lets a higher layer replace every lower breakpoint", () => {
      const overlay = overlays()
      const team = overlay("team", [layout("grid", "lg"), layout("row", "sm")])
      const personal = overlay("personal", [layout("stack")])
      const resolved = get(
        resolve([personal, team]).properties,
        "dashboard",
        "layout"
      )

      expect([...(resolved?.breakpoints?.keys() ?? [])]).toEqual(["md"])
      expect(resolved?.breakpoints?.get("md")?.check).toBe(personal.ops[0])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        team.ops[0],
        team.ops[1],
      ])
    })

    it("resolves span the same way", () => {
      const overlay = overlays()
      const span = (columns: number, at?: string) => ({
        op: "span",
        target: "dashboard/slots/a",
        columns,
        ...(at && { at }),
      })
      const org = overlay("org", [span(4, "xl")])
      const team = overlay("team", [span(2, "base"), span(3), span(1, "base")])
      const resolved = get(resolve([team, org]).properties, "a", "span")

      expect(
        [...(resolved?.breakpoints ?? [])].map(([at, { check }]) => [at, check])
      ).toEqual([
        ["base", team.ops[2]],
        ["md", team.ops[1]],
      ])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        org.ops[0],
        team.ops[0],
      ])
    })

    it("sets breakpoints only on layout and span", () => {
      const overlay = overlays()
      const personal = overlay("personal", [hide])

      expect(
        get(resolve([personal]).properties, notes, "visible")
      ).not.toHaveProperty("breakpoints")
    })
  })

  it("keys collapse per item on the container", () => {
    const overlay = overlays()
    const collapse = (items: string[], into: string) => ({
      op: "collapse",
      target: "dashboard",
      items,
      into,
    })
    const team = overlay("team", [collapse(["a", "b"], "more")])
    const personal = overlay("personal", [
      collapse(["c"], "accordion"),
      collapse(["a"], "tabs"),
    ])
    const { properties } = resolve([team, personal])

    expect(winner(properties, "dashboard", "collapse.a")).toBe(personal)
    expect(winner(properties, "dashboard", "collapse.b")).toBe(team)
    expect(winner(properties, "dashboard", "collapse.c")).toBe(personal)
    expect(
      get(properties, "dashboard", "collapse.a")?.overridden[0]?.check
    ).toBe(team.ops[0])
  })

  describe("placement", () => {
    const x = "dashboard/slots/x"

    it("shares one placement per item across structure and action ops", () => {
      const overlay = overlays()
      const team = overlay("team", [
        {
          op: "wrap",
          target: "dashboard",
          id: "top-row",
          items: ["x", "y"],
          mode: "row",
        },
        { op: "promote", target: "toolbar/actions/export" },
      ])
      const personal = overlay("personal", [
        { op: "move", target: x, to: { into: "sidebar" } },
        { op: "pin", target: x, where: "none" },
        { op: "demote", target: "toolbar/actions/export" },
      ])
      const { placements } = resolve([team, personal])

      expect(placementAt(placements, "x")?.winner?.check).toBe(personal.ops[1])
      expect(
        placementAt(placements, "x")?.overridden.map(({ check }) => check)
      ).toEqual([team.ops[0], personal.ops[0]])
      expect(placementAt(placements, "y")?.placement).toEqual({
        container: "top-row",
        position: { index: 1 },
      })
      expect(
        placementAt(placements, "toolbar/actions/export")?.placement
      ).toEqual({ container: "toolbar", position: { promoted: false } })
    })

    it("keeps the container when only the position changes", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "move", target: x, to: { into: "sidebar" } },
        { op: "pin", target: "sidebar/slots/x", where: "start" },
      ])
      const team = overlay("team", [
        {
          op: "move",
          target: "page/slots/dashboard/slots/y",
          to: { after: "x" },
        },
        { op: "pin", target: x, where: "sticky" },
      ])
      const { placements } = resolve([personal, team])

      expect(placementAt(placements, "x")?.placement).toEqual({
        container: "sidebar",
        position: { pin: "start" },
      })
      expect(placementAt(placements, "y")?.placement).toEqual({
        container: "dashboard",
        position: { after: "x" },
      })
    })

    it("copies a reorder's position instead of sharing the op's object", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "move", target: x, to: { before: "y" } },
      ])
      const placement = placementAt(resolve([personal]).placements, "x")

      expect(placement?.placement.position).toEqual({ before: "y" })
      expect(Object.values(placement?.winner?.check.op ?? {})).not.toContain(
        placement?.placement.position
      )
    })

    it("sets the container on move into and wrap", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "move", target: x, to: { into: "page/slots/sidebar" } },
      ])
      const team = overlay("team", [
        {
          op: "wrap",
          target: "dashboard",
          id: "pair",
          items: ["y", "x"],
          mode: "row",
        },
        { op: "move", target: "dashboard/slots/y", to: { index: 2 } },
      ])
      const { placements } = resolve([team, personal])

      expect(placementAt(placements, "x")?.placement).toEqual({
        container: "sidebar",
      })
      expect(placementAt(placements, "y")?.placement).toEqual({
        container: "pair",
        position: { index: 2 },
      })
      expect(placements.has("pair")).toBe(false)
    })
  })

  describe("identity", () => {
    it("keys a node on its bare id wherever it is addressed", () => {
      const overlay = overlays()
      const team = overlay("team", [
        insertChart,
        {
          op: "wrap",
          target: "dashboard",
          id: "top-row",
          items: ["revenue-chart", "orders"],
          mode: "row",
        },
        { op: "move", target: `dashboard/slots/${chart}`, to: { index: 0 } },
        { op: "hide", target: "page/slots/orders-table/columns/notes" },
      ])
      const personal = overlay("personal", [
        { op: "hide", target: `top-row/slots/${chart}` },
        { op: "show", target: `page/slots/${chart}` },
        { op: "show", target: notes },
      ])
      const { properties, placements } = resolve([team, personal])

      expect([...properties.keys()]).toEqual([
        chart,
        "top-row",
        "orders-table/columns/notes",
      ])
      expect([...placements.keys()]).toEqual([chart, "orders"])
      expect(winner(properties, "top-row", "inserted")).toBe(team)
      expect(get(properties, chart, "visible")?.winner.check).toBe(
        personal.ops[1]
      )
      expect(winner(properties, notes, "visible")).toBe(personal)
    })

    it("keeps a wrapper when ops address it as a slot", () => {
      const overlay = overlays()
      const w1 = "dashboard/slots/w1"
      const team = overlay("team", [wrapOp("dashboard", "w1")])
      const personal = overlay("personal", [
        { op: "span", target: w1, columns: 2 },
        { op: "hide", target: w1 },
        { op: "move", target: w1, to: { index: 0 } },
        { op: "pin", target: w1, where: "end" },
      ])
      const { properties, placements, unapplied } = resolve([personal, team])

      expect(unapplied).toEqual([])
      expect(get(properties, "w1", "inserted")?.winner.check).toBe(team.ops[0])
      expect(winner(properties, "w1", "span")).toBe(personal)
      expect(winner(properties, "w1", "visible")).toBe(personal)
      expect(placementAt(placements, "w1")?.placement).toEqual({
        container: "dashboard",
        position: { pin: "end" },
      })
      expect(properties.has(w1)).toBe(false)
    })

    it.each([
      ["across layers", true],
      ["within one overlay", false],
    ])("nests wrappers %s", (_, split) => {
      const overlay = overlays()
      const inner = {
        op: "wrap",
        target: "dashboard",
        id: "inner",
        items: ["a", "b"],
        mode: "row",
      }
      const outer = { ...inner, id: "outer", items: ["inner", "c"] }
      const input = split
        ? [overlay("personal", [outer]), overlay("team", [inner])]
        : [overlay("personal", [inner, outer])]
      const { properties, placements, unapplied } = resolve(input)

      expect(unapplied).toEqual([])
      expect(get(properties, "inner", "inserted")?.winner.check.op).toEqual(
        inner
      )
      expect(get(properties, "outer", "inserted")?.winner.check.op).toEqual(
        outer
      )
      expect(placementAt(placements, "inner")?.placement).toEqual({
        container: "outer",
        position: { index: 0 },
      })
      expect(placementAt(placements, "a")?.placement).toEqual({
        container: "inner",
        position: { index: 0 },
      })
    })
  })

  describe("user items", () => {
    it("keeps a separate id space per kind", () => {
      const overlay = overlays()
      const team = overlay("team", [derived("margin")])
      const personal = overlay("personal", [preset("margin"), derived("tax")])
      const override = overlay("personal", [derived("margin")])
      const { properties } = resolve([team, personal])

      expect(winner(properties, table, "derived.margin")).toBe(team)
      expect(winner(properties, table, "preset.margin")).toBe(personal)
      expect(
        winner(resolve([team, override]).properties, table, "derived.margin")
      ).toBe(override)
    })

    it("removes the id in every kind the same layer added it to", () => {
      const overlay = overlays()
      const first = overlay("personal", [derived("margin"), preset("margin")])
      const second = overlay("personal", [removeItem("margin")])
      const { properties, unapplied } = resolve([second, first])

      for (const property of ["derived.margin", "preset.margin"] as const) {
        expect(get(properties, table, property)?.winner.check).toBe(
          second.ops[0]
        )
      }
      expect(properties.get(table)?.has("highlight.margin")).toBe(false)
      expect(unapplied).toEqual([])
    })

    it("removes the scope's own part and reports the rest", () => {
      const overlay = overlays()
      const team = overlay("team", [derived("margin")])
      const personal = overlay("personal", [
        preset("margin"),
        removeItem("margin"),
      ])
      const { properties, unapplied } = resolve([team, personal])

      expect(winner(properties, table, "derived.margin")).toBe(team)
      expect(get(properties, table, "preset.margin")?.winner.check).toBe(
        personal.ops[1]
      )
      expect(unapplied).toEqual([
        {
          check: personal.ops[1],
          overlay: personal,
          reason: "cross-layer-remove",
        },
      ])
    })

    it("falls back to a lower layer's item of the same kind and id", () => {
      const overlay = overlays()
      const team = overlay("team", [derived("margin")])
      const personal = overlay("personal", [
        derived("margin"),
        removeItem("margin"),
      ])
      const readd = overlay("personal", [derived("margin")])
      const { properties, unapplied } = resolve([personal, team])
      const resolved = get(properties, table, "derived.margin")

      expect(resolved?.winner.check).toBe(team.ops[0])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        personal.ops[0],
        personal.ops[1],
      ])
      expect(unapplied).toEqual([])
      expect(
        get(
          resolve([team, personal, readd]).properties,
          table,
          "derived.margin"
        )?.winner.check
      ).toBe(readd.ops[0])
    })

    it("reports a removal of a lower layer's item or of nothing", () => {
      const overlay = overlays()
      const team = overlay("team", [derived("margin")])
      const personal = overlay("personal", [
        removeItem("margin"),
        removeItem("tax"),
      ])
      const { properties, unapplied } = resolve([personal, team])

      expect(winner(properties, table, "derived.margin")).toBe(team)
      expect(get(properties, table, "derived.margin")?.overridden).toEqual([])
      expect(unapplied).toEqual([
        {
          check: personal.ops[0],
          overlay: personal,
          reason: "cross-layer-remove",
        },
        {
          check: personal.ops[1],
          overlay: personal,
          reason: "nothing-to-remove",
        },
      ])
      expect(unapplied[0]?.check).toBe(personal.ops[0])
      expect(unapplied[0]?.overlay).toBe(personal)
    })

    it("reports removing an item twice, and lets a higher layer add it back", () => {
      const overlay = overlays()
      const team = overlay("team", [
        derived("margin"),
        removeItem("margin"),
        removeItem("margin"),
      ])
      const personal = overlay("personal", [derived("margin")])
      const { properties, unapplied } = resolve([team, personal])

      expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
        [team.ops[2], "nothing-to-remove"],
      ])
      expect(
        get(properties, table, "derived.margin")?.overridden.map(
          ({ check }) => check
        )
      ).toEqual([team.ops[0], team.ops[1]])
      expect(winner(properties, table, "derived.margin")).toBe(personal)
    })
  })

  describe("remove", () => {
    it("removes a node another overlay of the same team inserted", () => {
      const overlay = overlays()
      const first = overlay("team", [insertChart])
      const second = overlay("team", [removeChart])
      const { properties, unapplied } = resolve([second, first])

      expect(get(properties, chart, "inserted")?.winner.check).toBe(
        second.ops[0]
      )
      expect(get(properties, chart, "inserted")?.overridden[0]?.check).toBe(
        first.ops[0]
      )
      expect(unapplied).toEqual([])
    })

    it("doesn't remove a node another team inserted", () => {
      const overlay = overlays()
      const sales = overlay("team", [insertChart], { scope: "sales" })
      const support = overlay("team", [removeChart], { scope: "support" })
      const { properties, unapplied } = resolve([support, sales])

      expect(winner(properties, chart, "inserted")).toBe(sales)
      expect(unapplied).toEqual([
        {
          check: support.ops[0],
          overlay: support,
          reason: "cross-layer-remove",
        },
      ])
    })

    it("treats orgs as separate scopes", () => {
      const overlay = overlays()
      const acme = overlay("org", [insertChart], { scope: "acme" })
      const beta = overlay("org", [removeChart], { scope: "beta" })

      expect(resolve([acme, beta]).unapplied[0]?.reason).toBe(
        "cross-layer-remove"
      )
    })

    it("falls back to a lower layer's node after a re-insert is removed", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const personal = overlay("personal", [insertChart, removeChart])
      const resolved = get(
        resolve([personal, team]).properties,
        chart,
        "inserted"
      )

      expect(resolved?.winner.check).toBe(team.ops[0])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        personal.ops[0],
        personal.ops[1],
      ])
    })

    it("doesn't remove the lower layer's node it fell back to", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const personal = overlay("personal", [
        insertChart,
        removeChart,
        removeChart,
      ])
      const { properties, unapplied } = resolve([team, personal])

      expect(get(properties, chart, "inserted")?.winner.check).toBe(team.ops[0])
      expect(unapplied).toEqual([
        {
          check: personal.ops[2],
          overlay: personal,
          reason: "cross-layer-remove",
        },
      ])
    })

    it("falls back to a lower layer's own removal", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart, removeChart])
      const personal = overlay("personal", [insertChart, removeChart])
      const { properties, unapplied } = resolve([team, personal])

      expect(get(properties, chart, "inserted")?.winner.check).toBe(team.ops[1])
      expect(unapplied).toEqual([])
    })

    it("doesn't remove a node a lower layer inserted", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const personal = overlay("personal", [removeChart])
      const { properties, unapplied } = resolve([team, personal])

      expect(winner(properties, chart, "inserted")).toBe(team)
      expect(unapplied).toEqual([
        {
          check: personal.ops[0],
          overlay: personal,
          reason: "cross-layer-remove",
        },
      ])
    })

    it("reports removing a node that wasn't inserted", () => {
      const overlay = overlays()
      const personal = overlay("personal", [removeChart])
      const { properties, unapplied } = resolve([personal])

      expect(properties.has(chart)).toBe(false)
      expect(unapplied).toEqual([
        {
          check: personal.ops[0],
          overlay: personal,
          reason: "nothing-to-remove",
        },
      ])
    })
  })

  describe("remove by id", () => {
    it("removes an inserted node by its bare id or its slot", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const bare = overlay("team", [{ op: "remove", target: chart }])
      const slot = overlay("team", [removeChart])

      for (const removal of [bare, slot]) {
        const { properties, unapplied } = resolve([removal, team])
        expect(get(properties, chart, "inserted")?.winner.check).toBe(
          removal.ops[0]
        )
        expect(unapplied).toEqual([])
      }
    })

    it("removes a wrapper by its bare id or its slot, in its own scope only", () => {
      const overlay = overlays()
      const team = overlay("team", [wrapOp("dashboard", "pair")])
      const bare = overlay("team", [{ op: "remove", target: "pair" }])
      const slot = overlay("team", [
        { op: "remove", target: "dashboard/slots/pair" },
      ])
      const personal = overlay("personal", [{ op: "remove", target: "pair" }])

      for (const removal of [bare, slot]) {
        const { properties, placements } = resolve([removal, team])
        expect(get(properties, "pair", "inserted")?.winner.check).toBe(
          removal.ops[0]
        )
        expect(placementAt(placements, "a")).toEqual({
          placement: { container: "dashboard" },
          overridden: [{ check: team.ops[0], overlay: team }],
        })
      }
      const { properties, unapplied } = resolve([team, personal])
      expect(winner(properties, "pair", "inserted")).toBe(team)
      expect(unapplied).toEqual([
        {
          check: personal.ops[0],
          overlay: personal,
          reason: "cross-layer-remove",
        },
      ])
    })

    it("removes a nested wrapper and returns its items", () => {
      const overlay = overlays()
      const wrap = (id: string, items: string[]) => ({
        op: "wrap",
        target: "dashboard",
        id,
        items,
        mode: "row",
      })
      const team = overlay("team", [
        { op: "pin", target: "dashboard/slots/a", where: "start" },
      ])
      const personal = overlay("personal", [
        wrap("inner", ["a", "b"]),
        wrap("outer", ["inner", "c"]),
        { op: "remove", target: "inner" },
      ])
      const { properties, placements, unapplied } = resolve([personal, team])

      expect(unapplied).toEqual([])
      expect(get(properties, "inner", "inserted")?.winner.check).toBe(
        personal.ops[2]
      )
      expect(placementAt(placements, "a")?.winner?.check).toBe(team.ops[0])
      expect(placementAt(placements, "a")?.placement).toEqual({
        container: "dashboard",
        position: { pin: "start" },
      })
      expect(
        placementAt(placements, "a")?.overridden.map(({ check }) => check)
      ).toEqual([personal.ops[0]])
      expect(placementAt(placements, "b")?.placement).toEqual({
        container: "dashboard",
      })
      expect(winner(properties, "outer", "inserted")).toBe(personal)
    })
  })

  describe("wrap", () => {
    const wrap = (target: string, id: string, items: string[]) => ({
      op: "wrap",
      target,
      id,
      items,
      mode: "row",
    })
    const x = "dashboard/slots/x"
    const moveX = { op: "move", target: x, to: { into: "sidebar" } }

    it("places an item moved into the target once", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        moveX,
        wrap("sidebar", "pair", ["x", "y"]),
      ])
      const { properties, placements } = resolve([personal])

      expect(placementAt(placements, "x")?.winner?.check).toBe(personal.ops[1])
      expect(placementAt(placements, "x")?.overridden[0]?.check).toBe(
        personal.ops[0]
      )
      expect(properties.has("sidebar/slots/x")).toBe(false)
    })

    it("returns items a replacing wrap drops to their placement just before it", () => {
      const overlay = overlays()
      const team = overlay("team", [{ op: "pin", target: x, where: "start" }])
      const personal = overlay("personal", [
        { op: "move", target: "dashboard/slots/y", to: { index: 1 } },
        wrap("dashboard", "pair", ["x", "y", "z"]),
        wrap("dashboard", "pair", ["z", "w"]),
      ])
      const { properties, placements, unapplied } = resolve([personal, team])

      expect(unapplied).toEqual([])
      expect(get(properties, "pair", "inserted")?.winner.check).toBe(
        personal.ops[2]
      )
      expect(placementAt(placements, "x")?.winner?.check).toBe(team.ops[0])
      expect(placementAt(placements, "x")?.placement).toEqual({
        container: "dashboard",
        position: { pin: "start" },
      })
      expect(
        placementAt(placements, "x")?.overridden.map(({ check }) => check)
      ).toEqual([personal.ops[1]])
      expect(placementAt(placements, "y")?.winner?.check).toBe(personal.ops[0])
      expect(placementAt(placements, "y")?.placement).toEqual({
        container: "dashboard",
        position: { index: 1 },
      })
      expect(
        placementAt(placements, "y")?.overridden.map(({ check }) => check)
      ).toEqual([personal.ops[1]])
      expect(placementAt(placements, "z")?.placement).toEqual({
        container: "pair",
        position: { index: 0 },
      })
      expect(placementAt(placements, "w")?.placement).toEqual({
        container: "pair",
        position: { index: 1 },
      })
    })

    describe.each([
      ["re-wrap", wrap("dashboard", "w", ["b", "d"])],
      ["removal", { op: "remove", target: "w" }],
    ])("after a %s", (_, release) => {
      const before = [
        { op: "pin", target: "dashboard/slots/a", where: "start" },
        { op: "pin", target: "dashboard/slots/c", where: "end" },
        wrap("dashboard", "w", ["a", "b"]),
      ]

      it.each([
        [
          "a pin inside the wrapper",
          { op: "pin", target: "w/slots/a", where: "end" },
          { a: [2, 3], c: [] },
        ],
        [
          "a reorder inside the wrapper",
          { op: "move", target: "w/slots/a", to: { index: 1 } },
          { a: [2, 3], c: [] },
        ],
        [
          "a move into the wrapper",
          { op: "move", target: "dashboard/slots/c", to: { into: "w" } },
          { a: [2], c: [3] },
        ],
      ])("returns every item in the wrapper after %s", (_, inside, moved) => {
        const overlay = overlays()
        const personal = overlay("personal", [...before, inside, release])
        const { placements, unapplied } = resolve([personal])

        expect(unapplied).toEqual([])
        expect(placementAt(placements, "a")?.winner?.check).toBe(
          personal.ops[0]
        )
        expect(placementAt(placements, "c")?.winner?.check).toBe(
          personal.ops[1]
        )
        for (const [item, indexes] of Object.entries(moved)) {
          expect(
            placementAt(placements, item)?.overridden.map(({ check }) => check)
          ).toEqual(indexes.map((index) => personal.ops[index]))
        }
      })
    })

    it.each([
      ["a wrapper", wrap("page/slots/dashboard", "w", ["a", "b"]), "sidebar"],
      [
        "an inserted node",
        {
          op: "insert",
          target: "dashboard",
          node: { id: "w", kind: "chart", dataset: "orders" },
          at: { index: 0 },
        },
        "sidebar",
      ],
    ])(
      "returns an item with no earlier placement to where it was before %s",
      (_, create, origin) => {
        const overlay = overlays()
        const personal = overlay("personal", [
          create,
          { op: "move", target: `${origin}/slots/c`, to: { into: "w" } },
          { op: "remove", target: "w" },
        ])
        const { placements } = resolve([personal])

        expect(placementAt(placements, "c")).toEqual({
          placement: { container: origin },
          overridden: [{ check: personal.ops[1], overlay: personal }],
        })
      }
    )

    it("lets a re-wrap replace a pin inside the wrapper on an item it keeps", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        wrap("dashboard", "w", ["a", "b"]),
        { op: "pin", target: "w/slots/a", where: "end" },
        wrap("dashboard", "w", ["c", "a"]),
      ])
      const { placements } = resolve([personal])

      expect(placementAt(placements, "a")?.winner?.check).toBe(personal.ops[2])
      expect(placementAt(placements, "a")?.placement).toEqual({
        container: "w",
        position: { index: 1 },
      })
    })

    it("brings back a pin the same user set before wrapping", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "pin", target: "dashboard/slots/a", where: "start" },
        wrap("dashboard", "pair", ["a", "b"]),
        wrap("dashboard", "pair", ["b", "c"]),
      ])
      const { placements } = resolve([personal])

      expect(placementAt(placements, "a")?.winner?.check).toBe(personal.ops[0])
      expect(placementAt(placements, "a")?.placement).toEqual({
        container: "dashboard",
        position: { pin: "start" },
      })
      expect(placementAt(placements, "b")?.placement).toEqual({
        container: "pair",
        position: { index: 0 },
      })
    })

    it("passes over earlier versions of the wrap in a chain of re-wraps", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "pin", target: "dashboard/slots/a", where: "start" },
        wrap("dashboard", "pair", ["a", "b"]),
        wrap("dashboard", "pair", ["b", "a"]),
        wrap("dashboard", "pair", ["b", "c"]),
      ])
      const { placements } = resolve([personal])
      const a = placementAt(placements, "a")

      expect(a?.winner?.check).toBe(personal.ops[0])
      expect(a?.placement).toEqual({
        container: "dashboard",
        position: { pin: "start" },
      })
      expect(a?.overridden.map(({ check }) => check)).toEqual([
        personal.ops[1],
        personal.ops[2],
      ])
    })

    it("returns items past wraps that were removed meanwhile", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        { op: "pin", target: "dashboard/slots/c", where: "end" },
        wrap("dashboard", "outer", ["a", "c"]),
        wrap("dashboard", "inner", ["c", "d"]),
        { op: "remove", target: "outer" },
        { op: "remove", target: "dashboard/slots/inner" },
      ])
      const { placements, unapplied } = resolve([personal])

      expect(unapplied).toEqual([])
      expect(placementAt(placements, "c")?.winner?.check).toBe(personal.ops[0])
      expect(placementAt(placements, "a")).toEqual({
        placement: { container: "dashboard" },
        overridden: [{ check: personal.ops[1], overlay: personal }],
      })
    })

    describe("container versions", () => {
      const insertAt = (target: string, id: string) => ({
        op: "insert",
        target,
        node: { id, kind: "chart", dataset: "orders" },
        at: { index: 0 },
      })
      const move = (target: string, into: string) => ({
        op: "move",
        target,
        to: { into },
      })
      const removeNode = (id: string) => ({ op: "remove", target: id })
      // aa and bb end up created in each other: bb in aa, then aa again in bb.
      const cycle = [
        insertAt("dashboard", "aa"),
        insertAt("aa", "bb"),
        removeNode("aa"),
        insertAt("bb", "aa"),
      ]
      const at = (placements: ResolvedLayers["placements"], item: string) =>
        placementAt(placements, item)

      it("returns an item from nested wrappers to where it came from", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("dashboard", "inner", ["a", "b"]),
          wrap("dashboard", "outer", ["inner", "c"]),
          move("sidebar/slots/d", "inner"),
          { op: "pin", target: "inner/slots/a", where: "start" },
          removeNode("outer"),
          removeNode("inner"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "d")?.placement).toEqual({
          container: "sidebar",
        })
        expect(at(placements, "a")?.placement).toEqual({
          container: "dashboard",
        })
        expect(at(placements, "inner")?.placement).toEqual({
          container: "dashboard",
        })
        expect(at(placements, "a")?.winner).toBeUndefined()
      })

      it("passes over a wrap version that was replaced twice", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("sidebar", "x"),
          wrap("dashboard", "w", ["a", "b"]),
          wrap("dashboard", "w", ["b", "c"]),
          move("dashboard/slots/a", "x"),
          wrap("dashboard", "w", ["c", "b"]),
          removeNode("x"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "a")?.placement).toEqual({
          container: "dashboard",
        })
      })

      it("never returns an item into an earlier version of a wrapper", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("sidebar", "x"),
          wrap("dashboard", "w", ["a", "b"]),
          { op: "pin", target: "w/slots/a", where: "end" },
          move("w/slots/a", "x"),
          wrap("dashboard", "w", ["b", "c"]),
          removeNode("x"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "a")).toEqual({
          placement: { container: "dashboard" },
          overridden: personal.ops
            .slice(1, 4)
            .map((check) => ({ check, overlay: personal })),
        })
      })

      it("never returns an item into a node created again", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("sidebar", "x"),
          insertAt("footer", "y"),
          move("dashboard/slots/c", "x"),
          move("x/slots/c", "y"),
          removeNode("x"),
          insertAt("sidebar", "x"),
          removeNode("y"),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["dashboard", "sidebar", "footer", "c"],
        })

        expect(unapplied).toEqual([])
        expect(at(placements, "c")?.placement).toEqual({
          container: "dashboard",
        })
        expect(at(placements, "c")?.winner).toBeUndefined()
      })

      it.each([[{ baseIds: ["dashboard", "sidebar", "c"] }], [{}]])(
        "reports a move into a node removed before it (%j)",
        (options) => {
          const overlay = overlays()
          const personal = overlay("personal", [
            insertAt("sidebar", "x"),
            removeNode("x"),
            move("dashboard/slots/c", "x"),
          ])
          const { placements, unapplied } = resolve([personal], options)

          expect(unapplied).toEqual([
            {
              check: personal.ops[2],
              overlay: personal,
              reason: "missing-container",
            },
          ])
          expect(placements.has("c")).toBe(false)
        }
      )

      it("reports a move into a node that doesn't exist yet", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          move("dashboard/slots/c", "v"),
          wrap("dashboard", "v", ["a", "b"]),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["dashboard", "a", "b", "c"],
        })

        expect(unapplied).toEqual([
          {
            check: personal.ops[0],
            overlay: personal,
            reason: "missing-container",
          },
        ])
        expect(placements.has("c")).toBe(false)
        expect(at(placements, "a")?.placement).toEqual({
          container: "v",
          position: { index: 0 },
        })
      })

      it("keeps an item in a node another scope inserts again at its target", () => {
        const overlay = overlays()
        const team = overlay("team", [
          insertAt("dashboard", "x"),
          move("sidebar/slots/c", "x"),
        ])
        const personal = overlay("personal", [
          insertAt("dashboard", "x"),
          removeNode("x"),
        ])
        const { placements } = resolve([personal, team])

        expect(at(placements, "c")?.winner?.check).toBe(team.ops[1])
        expect(at(placements, "c")?.placement).toEqual({ container: "x" })
      })

      it("counts the moved item's own base parent as existing", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          move("dashboard/slots/a", "sidebar"),
          move("sidebar/slots/a", "dashboard"),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["a", "sidebar"],
        })

        expect(unapplied).toEqual([])
        expect(at(placements, "a")?.winner?.check).toBe(personal.ops[1])
        expect(at(placements, "a")?.placement).toEqual({
          container: "dashboard",
        })
      })

      it("takes the base parent from the first op that placed the item", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          move("dashboard/slots/c", "sidebar"),
          { op: "pin", target: "sidebar/slots/c", where: "start" },
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["c"],
        })

        expect(unapplied.map(({ reason }) => reason)).toEqual([
          "missing-container",
        ])
        expect(at(placements, "c")?.placement).toEqual({
          container: "sidebar",
          position: { pin: "start" },
        })
      })

      it("lets a move into an unknown node apply without baseIds", () => {
        const overlay = overlays()
        const personal = overlay("personal", [move("dashboard/slots/c", "v")])
        const { placements, unapplied } = resolve([personal])

        expect(unapplied).toEqual([])
        expect(at(placements, "c")?.placement).toEqual({ container: "v" })
      })

      it.each([
        [
          "a slot's parent",
          { op: "pin", target: "dashboard/slots/a", where: "start" },
          "a",
          { container: "dashboard", position: { pin: "start" } },
        ],
        [
          "a column's table",
          { op: "pin", target: "orders-table/columns/notes", where: "end" },
          "orders-table/columns/notes",
          { container: "orders-table", position: { pin: "end" } },
        ],
        [
          "a column reorder",
          {
            op: "move",
            target: "orders-table/columns/notes",
            to: { before: "total" },
          },
          "orders-table/columns/notes",
          { container: "orders-table", position: { before: "total" } },
        ],
        [
          "an action's toolbar",
          { op: "promote", target: "tb/actions/x" },
          "tb/actions/x",
          { container: "tb", position: { promoted: true } },
        ],
        [
          "a template's slot",
          { op: "pin", target: "card[]/slots/title", where: "start" },
          "title",
          { container: "card[]", position: { pin: "start" } },
        ],
      ])(
        "keeps a position in %s that baseIds doesn't list",
        (_, op, item, placement) => {
          const overlay = overlays()
          const personal = overlay("personal", [op])
          const { placements } = resolve([personal], {
            baseIds: ["a", "b", "card"],
          })

          expect(at(placements, item)?.winner?.check).toBe(personal.ops[0])
          expect(at(placements, item)?.placement).toEqual(placement)
        }
      )

      it("sends an item inserted into a removed wrapper where the wrapper was", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("page/slots/dashboard", "w", ["a", "b"]),
          wrap("dashboard", "outer", ["w", "c"]),
          insertAt("w", "y"),
          { op: "move", target: "w/slots/y", to: { index: 0 } },
          removeNode("w"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "y")).toEqual({
          placement: { container: "outer" },
          overridden: [{ check: personal.ops[3], overlay: personal }],
        })
        expect(at(placements, "a")?.placement).toEqual({
          container: "dashboard",
        })
      })

      it("sends an item through a chain of removed nodes", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("page/slots/dashboard", "outer", ["a", "b"]),
          insertAt("outer", "x"),
          insertAt("x", "y"),
          { op: "pin", target: "x/slots/y", where: "start" },
          removeNode("x"),
          removeNode("outer"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "y")?.placement).toEqual({
          container: "dashboard",
        })
      })

      it("keeps a position set after its parent was removed", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("dashboard", "x"),
          insertAt("x", "y"),
          removeNode("x"),
          { op: "pin", target: "dashboard/slots/y", where: "start" },
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "y")).toEqual({
          winner: { check: personal.ops[3], overlay: personal },
          placement: { container: "dashboard", position: { pin: "start" } },
          overridden: [],
        })
      })

      it.each([
        [
          "a pin",
          { op: "pin", target: "sidebar/slots/y", where: "start" },
          "dashboard",
          "dashboard",
        ],
        [
          "a move",
          { op: "move", target: "sidebar/slots/y", to: { into: "dashboard" } },
          "sidebar",
          "sidebar",
        ],
      ])(
        "starts a node created again over, after %s of the earlier one",
        (_, place, again, container) => {
          const overlay = overlays()
          const personal = overlay("personal", [
            insertAt("sidebar", "y"),
            place,
            removeNode("y"),
            insertAt(again, "y"),
          ])
          const { placements } = resolve([personal], {
            baseIds: ["sidebar", "dashboard"],
          })

          expect(at(placements, "y")).toEqual({
            placement: { container },
            overridden: [{ check: personal.ops[1], overlay: personal }],
          })
        }
      )

      it("keeps a position where a node created again now is", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("sidebar", "y"),
          { op: "pin", target: "dashboard/slots/y", where: "start" },
          removeNode("y"),
          insertAt("footer", "y"),
          { op: "pin", target: "dashboard/slots/y", where: "end" },
        ])
        const { placements } = resolve([personal], {
          baseIds: ["dashboard", "sidebar", "footer"],
        })

        expect(at(placements, "y")).toEqual({
          winner: { check: personal.ops[4], overlay: personal },
          placement: { container: "footer", position: { pin: "end" } },
          overridden: [{ check: personal.ops[1], overlay: personal }],
        })
      })

      it("keeps a position in the node an item was created in", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("sidebar", "y"),
          { op: "pin", target: "dashboard/slots/y", where: "start" },
        ])
        const { placements } = resolve([personal], {
          baseIds: ["dashboard", "sidebar"],
        })

        expect(at(placements, "y")?.winner?.check).toBe(personal.ops[1])
        expect(at(placements, "y")?.placement).toEqual({
          container: "sidebar",
          position: { pin: "start" },
        })
      })

      it("keeps a position on the surface once every parent is gone", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          ...cycle,
          insertAt("aa", "y"),
          removeNode("aa"),
          removeNode("bb"),
          { op: "pin", target: "aa/slots/y", where: "start" },
        ])
        const { placements } = resolve([personal], { baseIds: ["dashboard"] })

        expect(at(placements, "y")?.winner?.check).toBe(personal.ops[7])
        expect(at(placements, "y")?.placement).toEqual({
          container: "@surface",
          position: { pin: "start" },
        })
      })

      describe("a position set while the base parent is removed", () => {
        const setup = [
          insertAt("page", "host"),
          wrap("host", "w", ["a", "b"]),
          insertAt("w", "y"),
          removeNode("w"),
          { op: "pin", target: "host/slots/y", where: "start" },
        ]
        const baseIds = ["page", "a", "b"]

        it("follows the base parent chain, in a container baseIds doesn't list", () => {
          const overlay = overlays()
          const personal = overlay("personal", setup)
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")).toEqual({
            winner: { check: personal.ops[4], overlay: personal },
            placement: { container: "host", position: { pin: "start" } },
            overridden: [],
          })
        })

        it("follows the chain when the walked container is removed later", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            ...setup,
            { op: "pin", target: "host/slots/y", where: "end" },
            removeNode("host"),
          ])
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")).toEqual({
            winner: { check: personal.ops[5], overlay: personal },
            placement: { container: "page", position: { pin: "end" } },
            overridden: [{ check: personal.ops[4], overlay: personal }],
          })
        })

        it("follows the base parent when it is created again", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            ...setup,
            wrap("page", "w", ["a", "c"]),
          ])
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")?.winner?.check).toBe(personal.ops[4])
          expect(at(placements, "y")?.placement).toEqual({
            container: "w",
            position: { pin: "start" },
          })
        })

        it("stops following once a move places the item", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            ...setup,
            move("host/slots/y", "page"),
            { op: "pin", target: "page/slots/y", where: "end" },
            removeNode("host"),
          ])
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")?.placement).toEqual({
            container: "page",
            position: { pin: "end" },
          })
        })

        it("keeps every item out of removed nodes as the chain changes", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            insertAt("dashboard", "bb"),
            insertAt("bb", "aa"),
            insertAt("aa", "y1"),
            insertAt("aa", "y2"),
            removeNode("aa"),
            { op: "pin", target: "aa/slots/y1", where: "start" },
            removeNode("bb"),
            { op: "pin", target: "aa/slots/y2", where: "start" },
          ])
          const { placements } = resolve([personal], {
            baseIds: ["dashboard"],
          })

          expect(placements.get("y1")?.container).toBe("dashboard")
          expect(placements.get("y2")?.container).toBe("dashboard")
        })
      })

      describe("under a removed node", () => {
        const removed = [
          insertAt("dashboard", "p"),
          insertAt("p", "y"),
          removeNode("p"),
          move("p/slots/y", "sidebar"),
        ]
        const baseIds = ["dashboard", "sidebar"]

        it("lets a move into a live node place the item there", () => {
          const overlay = overlays()
          const personal = overlay("personal", removed)
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")?.winner?.check).toBe(personal.ops[3])
          expect(at(placements, "y")?.placement).toEqual({
            container: "sidebar",
          })
        })

        it("keeps a later pin in the node the move placed the item in", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            ...removed,
            { op: "pin", target: "sidebar/slots/y", where: "start" },
          ])
          const { placements } = resolve([personal], { baseIds })

          expect(at(placements, "y")?.placement).toEqual({
            container: "sidebar",
            position: { pin: "start" },
          })
        })
      })

      it("reports an id collision before a missing container", () => {
        const overlay = overlays()
        const personal = overlay("personal", [insertAt("ghost", "orders")])
        const { unapplied } = resolve([personal], {
          baseIds: ["dashboard", "orders"],
        })

        expect(unapplied.map(({ reason }) => reason)).toEqual(["id-collision"])
      })

      it("leaves an item's placement alone when its insert is rejected", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "pin", target: "dashboard/slots/y", where: "start" },
          insertAt("dashboard", "p"),
          removeNode("p"),
          insertAt("p", "y"),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["dashboard"],
        })

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [personal.ops[3], "missing-container"],
        ])
        expect(at(placements, "y")?.winner?.check).toBe(personal.ops[0])
        expect(at(placements, "y")?.placement).toEqual({
          container: "dashboard",
          position: { pin: "start" },
        })
      })

      it("drops a pin in an unlisted parent once a node takes its id", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "pin", target: "dashboard/slots/a", where: "start" },
          insertAt("sidebar", "dashboard"),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["sidebar", "a"],
        })

        expect(unapplied).toEqual([])
        expect(at(placements, "a")).toEqual({
          placement: { container: "dashboard" },
          overridden: [{ check: personal.ops[0], overlay: personal }],
        })
      })

      it("lets a wrap target its items' own unlisted base parent", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "pin", target: "dashboard/slots/a", where: "start" },
          wrap("dashboard", "w", ["a", "b"]),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["a", "b"],
        })

        expect(unapplied).toEqual([])
        expect(at(placements, "a")?.placement).toEqual({
          container: "w",
          position: { index: 0 },
        })
      })

      it("reports an insert or wrap into a node that doesn't exist", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("dashboard", "aa"),
          removeNode("aa"),
          insertAt("aa", "zz"),
          insertAt("nowhere", "yy"),
          wrap("sidebar", "w", ["a", "b"]),
          { op: "pin", target: "dashboard/slots/y", where: "start" },
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["dashboard", "a", "b"],
        })

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [personal.ops[2], "missing-container"],
          [personal.ops[3], "missing-container"],
          [personal.ops[4], "missing-container"],
        ])
        expect([...placements.keys()]).toEqual(["y"])
      })

      it("lets an item go back into its own unlisted base parent when created", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "pin", target: "sidebar/slots/y", where: "start" },
          insertAt("sidebar", "y"),
          insertAt("footer", "z"),
        ])
        const { unapplied } = resolve([personal], { baseIds: ["x"] })

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [personal.ops[2], "missing-container"],
        ])
      })

      it("walks a cycle of removed nodes once", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          ...cycle,
          insertAt("aa", "y"),
          removeNode("aa"),
          removeNode("bb"),
        ])
        const spy = vi.spyOn(Map.prototype, "get")
        try {
          resolve([personal], { baseIds: ["dashboard"] })
          expect(spy.mock.calls.length).toBeLessThan(1000)
        } finally {
          spy.mockRestore()
        }
      })

      it("lets an insert into a node's own child create a cycle", () => {
        const overlay = overlays()
        const personal = overlay("personal", cycle)
        const { properties, unapplied } = resolve([personal], {
          baseIds: ["dashboard"],
        })

        expect(unapplied).toEqual([])
        expect(winner(properties, "aa", "inserted")).toBe(personal)
      })

      it("keeps a live wrapper's placement when it is re-wrapped", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("dashboard", "w", ["a", "b"]),
          move("dashboard/slots/w", "sidebar"),
          wrap("dashboard", "w", ["b", "c"]),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "w")?.winner?.check).toBe(personal.ops[1])
        expect(at(placements, "w")?.placement).toEqual({ container: "sidebar" })
      })

      it("lists a node whose parent was removed, even with no placement op", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("dashboard", "w", ["a", "b"]),
          insertAt("w", "y"),
          removeNode("w"),
        ])
        const { placements } = resolve([personal])

        expect(placements.get("y")).toEqual({
          container: "dashboard",
          overridden: [],
        })
      })

      it("stops at the first live node up a chain of removed ones", () => {
        const overlay = overlays()
        const ops = [
          insertAt("dashboard", "w1"),
          insertAt("w1", "w2"),
          insertAt("w2", "w3"),
          insertAt("w3", "y"),
          removeNode("w3"),
        ]
        const one = resolve([overlay("personal", ops)])
        const two = resolve([overlay("personal", [...ops, removeNode("w2")])])

        expect(one.placements.get("y")?.container).toBe("w2")
        expect(two.placements.get("y")?.container).toBe("w1")
        expect(two.placements.has("w3")).toBe(false)
      })

      it("puts an item on the surface when its removed parents form a cycle", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          ...cycle,
          insertAt("aa", "y"),
          { op: "move", target: "aa/slots/y", to: { index: 0 } },
          removeNode("aa"),
          removeNode("bb"),
        ])
        const { placements, unapplied } = resolve([personal], {
          baseIds: ["dashboard"],
        })

        expect(unapplied).toEqual([])
        expect(at(placements, "y")).toEqual({
          placement: { container: "@surface" },
          overridden: [{ check: personal.ops[5], overlay: personal }],
        })
      })

      it(
        "walks a chain of 100,000 removed nodes without throwing",
        () => {
          const depth = 100_000
          const ops: unknown[] = [insertAt("dashboard", "n0")]
          for (let level = 1; level < depth; level++) {
            ops.push(insertAt(`n${String(level - 1)}`, `n${String(level)}`))
          }
          ops.push(insertAt(`n${String(depth - 1)}`, "y"))
          for (let level = depth - 1; level >= 0; level--) {
            ops.push(removeNode(`n${String(level)}`))
          }
          const input = chunked(ops)

          expect(resolve(input).placements.get("y")?.container).toBe(
            "dashboard"
          )
        },
        // Loading 400 overlays takes a few seconds on a busy machine.
        60_000
      )

      it("keeps an inserted node's own target as its base parent", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          insertAt("page/slots/dashboard", "y"),
          { op: "pin", target: "sidebar/slots/y", where: "start" },
          wrap("dashboard", "w", ["y", "b"]),
          removeNode("w"),
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "y")?.placement).toEqual({
          container: "dashboard",
          position: { pin: "start" },
        })
        expect(at(placements, "b")?.placement).toEqual({
          container: "dashboard",
        })
      })

      it("takes the container of the placement that still holds", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "pin", target: "sidebar/slots/c", where: "start" },
          wrap("dashboard", "w", ["a", "b"]),
          move("sidebar/slots/c", "w"),
          removeNode("w"),
          { op: "pin", target: "w/slots/c", where: "end" },
        ])
        const { placements } = resolve([personal])

        expect(at(placements, "c")?.placement).toEqual({
          container: "sidebar",
          position: { pin: "end" },
        })
      })
    })

    it("leaves a dropped item that has moved on", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        wrap("dashboard", "pair", ["x", "y"]),
        moveX,
        wrap("dashboard", "pair", ["y", "z"]),
      ])
      const { placements } = resolve([personal])

      expect(placementAt(placements, "x")?.winner?.check).toBe(personal.ops[1])
    })

    describe("ids", () => {
      const collisions = (...input: LoadedOverlay[]) =>
        resolve(input).unapplied.map(({ check, reason }) => [check, reason])
      const insert = (target: string, id: string) => ({
        op: "insert",
        target,
        node: { id, kind: "chart", dataset: "orders" },
        at: { index: 0 },
      })

      it("rejects an id a base node has", () => {
        const overlay = overlays()
        const team = overlay("team", [
          { op: "hide", target: "dashboard/slots/orders" },
          wrap("dashboard", "orders", ["a", "b"]),
          wrap("dashboard", "a", ["a", "b"]),
          wrap("dashboard", "dashboard", ["a", "b"]),
          insert("dashboard", "dashboard"),
          insert("page", "orders"),
        ])
        const personal = overlay("personal", [
          {
            op: "move",
            target: "page/slots/c",
            to: { into: "page/slots/sidebar" },
          },
        ])
        const org = overlay("org", [wrap("dashboard", "sidebar", ["a", "b"])])
        const session = overlay("session", [insert("dashboard", "c")])
        const { properties, unapplied } = resolve([
          session,
          team,
          personal,
          org,
        ])

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [team.ops[1], "id-collision"],
          [team.ops[2], "id-collision"],
          [team.ops[3], "id-collision"],
          [team.ops[4], "id-collision"],
          [team.ops[5], "id-collision"],
          [session.ops[0], "id-collision"],
        ])
        expect(properties.has("sidebar")).toBe(true)
        expect(properties.get("orders")?.has("inserted")).toBe(false)
        expect(properties.has("c")).toBe(false)
      })

      it("rejects an insert or wrap id another node has, whichever came first", () => {
        const overlay = overlays()
        const team = overlay("team", [
          insertChart,
          wrap("page", chart, ["a", "b"]),
          wrap("dashboard", "pair", ["a", "b"]),
          insert("page", "pair"),
          insert("page", chart),
        ])
        const personal = overlay("personal", [
          insertChart,
          removeChart,
          wrap("page", chart, ["a", "b"]),
          insert("dashboard", chart),
        ])

        expect(collisions(team)).toEqual([
          [team.ops[1], "id-collision"],
          [team.ops[3], "id-collision"],
          [team.ops[4], "id-collision"],
        ])
        expect(collisions(personal)).toEqual([
          [personal.ops[3], "id-collision"],
        ])
        expect(collisions(team, personal)).toEqual([
          [team.ops[1], "id-collision"],
          [team.ops[3], "id-collision"],
          [team.ops[4], "id-collision"],
          [personal.ops[2], "id-collision"],
        ])
      })

      describe("with baseIds", () => {
        it("lets a higher team insert an id a lower team only pointed at", () => {
          const overlay = overlays()
          const aaa = overlay("team", [{ op: "hide", target: x }], {
            scope: "aaa",
          })
          const zzz = overlay("team", [insert("dashboard", "x")], {
            scope: "zzz",
          })

          expect(
            resolve([zzz, aaa], { baseIds: ["dashboard", "y"] }).unapplied
          ).toEqual([])
          expect(
            winner(
              resolve([zzz, aaa], { baseIds: new Set(["dashboard"]) })
                .properties,
              "x",
              "inserted"
            )
          ).toBe(zzz)
          expect(collisions(zzz, aaa)).toEqual([[zzz.ops[0], "id-collision"]])
        })

        it("rejects exactly the listed ids, still with the live node rules", () => {
          const overlay = overlays()
          const personal = overlay("personal", [
            insert("dashboard", "orders"),
            wrap("dashboard", "pair", ["a", "b"]),
            insert("page", "pair"),
            wrap("dashboard", "a", ["a", "b"]),
            insert("dashboard", "fresh"),
          ])
          const { unapplied } = resolve([personal], {
            baseIds: ["orders", "dashboard", "page"],
          })

          expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual(
            [
              [personal.ops[0], "id-collision"],
              [personal.ops[2], "id-collision"],
              [personal.ops[3], "id-collision"],
            ]
          )
        })
      })

      it("rejects a re-wrap that lists its own id", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          wrap("dashboard", "w", ["a", "b"]),
          wrap("dashboard", "w", ["w", "c"]),
        ])
        const { properties, unapplied } = resolve([personal])

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [personal.ops[1], "id-collision"],
        ])
        expect(get(properties, "w", "inserted")?.winner.check).toBe(
          personal.ops[0]
        )
      })

      it("doesn't take an id from a template", () => {
        const overlay = overlays()
        const personal = overlay("personal", [
          { op: "hide", target: "card[]" },
          insert("dashboard", "card"),
        ])
        const { properties, unapplied } = resolve([personal])

        expect(unapplied).toEqual([])
        expect(properties.has("card[]")).toBe(true)
        expect(winner(properties, "card", "inserted")).toBe(personal)
      })

      it("lets an insert replace one at the same target from another scope", () => {
        const overlay = overlays()
        const team = overlay("team", [insertChart])
        const personal = overlay("personal", [
          insert("page/slots/dashboard", chart),
        ])
        const { properties, unapplied } = resolve([personal, team])

        expect(unapplied).toEqual([])
        expect(winner(properties, chart, "inserted")).toBe(personal)
      })

      it("rejects another scope's or target's wrap id, and allows replacing", () => {
        const overlay = overlays()
        const sales = overlay("team", [wrap("dashboard", "pair", ["a", "b"])])
        const support = overlay(
          "team",
          [wrap("dashboard", "pair", ["c", "d"])],
          { scope: "support" }
        )
        const personal = overlay("personal", [
          wrap("page", "group", ["a", "b"]),
          wrap("page", "group", ["c", "d"]),
          wrap("footer", "group", ["c", "d"]),
        ])

        expect(collisions(sales, support)).toEqual([
          [support.ops[0], "id-collision"],
        ])
        expect(collisions(personal)).toEqual([
          [personal.ops[2], "id-collision"],
        ])
        expect(
          get(resolve([personal]).properties, "group", "inserted")?.winner.check
        ).toBe(personal.ops[1])
      })
    })
  })

  describe("overlays", () => {
    const id = "01JBQ3V8Z7XKQ2M4N5P6R7S8ZZ"

    it("keeps the first of overlays with the same id", () => {
      const overlay = overlays()
      const team = overlay("team", [hide], { id })
      const personal = overlay(
        "personal",
        [show, { op: "setTheme", target: notes }],
        { id }
      )
      const later = overlay("team", [show], {
        id,
        createdAt: "2026-11-02T00:00:00.000Z",
      })

      for (const input of permutations([team, personal, later])) {
        const { properties, skipped } = resolve(input)
        expect(winner(properties, notes, "visible")).toBe(team)
        expect(
          skipped.map(({ check, overlay, reason }) => [check, overlay, reason])
        ).toEqual([
          [later.ops[0], later, "duplicate-id"],
          [personal.ops[0], personal, "duplicate-id"],
          [personal.ops[1], personal, "duplicate-id"],
        ])
      }
    })

    it("keeps one of tied overlays with identical contents", () => {
      const overlay = overlays()
      const team = overlay("team", [hide], { id })
      const twin = overlay("team", [hide], { id })
      const personal = overlay("personal", [show])

      for (const input of permutations([team, twin, personal])) {
        const { properties, skipped } = resolve(input)
        const kept = input.find((item) => item !== personal)
        const dropped = input.findLast((item) => item !== personal)
        expect(get(properties, notes, "visible")?.overridden[0]?.overlay).toBe(
          kept
        )
        expect(skipped).toEqual([
          { check: dropped?.ops[0], overlay: dropped, reason: "duplicate-id" },
        ])
        expect(skipped[0]?.overlay).toBe(dropped)
      }
    })

    it("skips every tied overlay when their contents differ", () => {
      const overlay = overlays()
      const team = overlay("team", [hide], { id })
      const other = overlay("team", [show, hide], { id })
      const third = {
        ...overlay("team", [hide], { id }),
        createdBy: "user_456",
        extra: { big: 1n, list: [1, { a: undefined }] },
      }
      const later = overlay("team", [show], {
        id,
        createdAt: "2026-11-03T00:00:00.000Z",
      })
      const results = permutations([team, other, third, later]).map((input) =>
        resolve(input)
      )

      for (const { properties, skipped } of results) {
        expect(properties.size).toBe(0)
        expect(skipped.map(({ reason }) => reason)).toEqual(
          Array.from({ length: 5 }, () => "duplicate-id")
        )
        expect(skipped).toEqual(results[0]?.skipped)
        expect(skipped.at(-1)?.overlay).toBe(later)
      }
    })

    it("compares deeply nested contents of tied overlays", () => {
      const overlay = overlays()
      const deep = (leaf: number) => {
        let value: unknown = leaf
        for (let level = 0; level < 8000; level++) {
          value = [value]
        }
        return value
      }
      const tied = (leaf: number) => ({
        ...overlay("team", [hide], { id }),
        extra: deep(leaf),
      })
      const same = [tied(1), tied(1)]
      const different = [tied(1), tied(2)]

      expect(resolve(same).skipped).toHaveLength(1)
      expect(resolve(different).skipped).toHaveLength(2)
    })

    it("throws when baseIds isn't an array or a Set", () => {
      const overlay = overlays()
      for (const baseIds of ["dashboard", null]) {
        expect(() =>
          // @ts-expect-error JavaScript callers can pass anything.
          resolve([overlay("team", [hide])], { baseIds })
        ).toThrow(TypeError)
      }
    })

    it("throws when the surface isn't a string", () => {
      const overlay = overlays()

      expect(() =>
        // @ts-expect-error JavaScript callers can leave the surface out.
        resolveLayers([overlay("team", [hide])], {})
      ).toThrow(TypeError)
    })

    it("doesn't count an overlay for another surface as a duplicate", () => {
      const overlay = overlays()
      const org = overlay("org", [hide])
      const other = overlay("team", [hide], { id, surface: "/invoices" })
      const personal = overlay("personal", [show], { id })
      const { properties, skipped } = resolve([personal, other, org])

      expect(winner(properties, notes, "visible")).toBe(personal)
      expect(skipped).toEqual([
        { check: other.ops[0], overlay: other, reason: "surface-mismatch" },
      ])
    })

    it("resolves the surface it's given, plus @app", () => {
      const overlay = overlays()
      const team = overlay("team", [hide])
      const other = overlay("personal", [show], { surface: "/invoices" })
      const app = overlay(
        "personal",
        [{ op: "setMotion", target: "@app", motion: "reduced" }],
        { surface: "@app" }
      )
      const { properties, skipped } = resolve([app, other, team])

      expect(winner(properties, notes, "visible")).toBe(team)
      expect(winner(properties, "@app", "motion")).toBe(app)
      expect(skipped).toEqual([
        { check: other.ops[0], overlay: other, reason: "surface-mismatch" },
      ])

      const invoices = resolve([app, other, team], { surface: "/invoices" })
      expect(winner(invoices.properties, notes, "visible")).toBe(other)
      expect(invoices.skipped.map(({ overlay }) => overlay)).toEqual([team])
      expect(
        resolve([team], { surface: "@app" }).skipped.map(({ reason }) => reason)
      ).toEqual(["surface-mismatch"])
    })
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
    const { properties, skipped } = resolve([personal, team])

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

  describe("on random overlays", () => {
    // A seeded generator keeps every run, and any failure, reproducible.
    const random = (seed: number) => () => {
      seed = (seed + 0x6d2b79f5) | 0
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }

    const generate = (next: () => number) => {
      const pick = <T>(items: readonly T[]): T => {
        const item = items[Math.floor(next() * items.length)]
        if (item === undefined) {
          throw new RangeError("Nothing to pick from")
        }
        return item
      }
      const ids = ["a", "b", "c", "w", "x"]
      // `w` and `x` are also ids, so items end up in inserted and removed
      // nodes, under parents that are later removed.
      const parents = ["dashboard", "sidebar", "page/slots/dashboard", "w", "x"]
      const slot = () => `${pick(parents)}/slots/${pick(ids)}`
      const opOf = (): unknown =>
        pick([
          () => ({ op: pick(["hide", "show"]), target: slot() }),
          () => ({
            op: "insert",
            target: pick(parents),
            node: { id: pick(ids), kind: "chart", dataset: "orders" },
            at: { index: 0 },
          }),
          () => ({ op: "remove", target: pick([slot(), pick(ids)]) }),
          () => ({ op: "remove", target: pick(["w", "x"]) }),
          () => {
            const first = pick(ids)
            return {
              op: "wrap",
              target: pick(parents),
              id: pick(ids),
              items: [first, pick(ids.filter((id) => id !== first))],
              mode: "row",
            }
          },
          () => ({
            op: "move",
            target: slot(),
            to: { into: pick(["footer", ...ids]) },
          }),
          () => ({ op: "move", target: slot(), to: { index: 1 } }),
          () => ({ op: "pin", target: slot(), where: "start" }),
          () => ({
            op: "span",
            target: slot(),
            columns: 2,
            at: pick(["sm", "md"]),
          }),
          () => derived(pick(ids)),
          () => preset(pick(ids)),
          () => removeItem(pick(ids)),
          () => ({ op: "setTheme", target: notes }),
          () => ({ op: "rename", target: notes, label: "" }),
        ])()
      return Array.from({ length: 6 }, () => {
        const layer = pick(["org", "team", "personal", "session"] as const)
        return overlayWith(
          layer,
          Array.from({ length: 1 + Math.floor(next() * 8) }, opOf),
          {
            id: `01JBQ3V8Z7XKQ2M4N5P6R7S8${pick(["A0", "A1", "A2", "A3"])}`,
            scope:
              layer === "org" ? pick(["acme", "beta"]) : pick(["sales", "ops"]),
            createdAt: pick([
              "2026-11-01T09:30:00.000Z",
              "2026-11-02T09:30:00.000Z",
            ]),
            surface: pick([surface, surface, surface, "/invoices"]),
          }
        )
      })
    }

    const label = ({
      check,
      overlay,
    }: {
      check: OpCheck
      overlay: LoadedOverlay
    }) =>
      `${overlay.layer}:${overlay.id}:${overlay.createdAt}:${String(check.index)}:${JSON.stringify(check.op)}`

    const canonical = ({
      properties,
      placements,
      skipped,
      unapplied,
    }: ResolvedLayers) => ({
      properties: [...properties].map(([address, node]) => [
        address,
        [...node].map(([key, property]) => [
          key,
          label(property.winner),
          property.overridden.map(label),
          [...(property.breakpoints ?? [])].map(([at, op]) => [at, label(op)]),
        ]),
      ]),
      placements: [...placements].map(([item, placed]) => [
        item,
        placed.container,
        placed.position,
        placed.winner && label(placed.winner),
        placed.overridden.map(label),
      ]),
      skipped: skipped.map((op) => [label(op), op.reason]),
      unapplied: unapplied.map((op) => [label(op), op.reason]),
    })

    // Every final placement must be in a container that exists, in the very
    // version it had when the item was placed there, or follow the base: then
    // it is wherever the item's base parent chain ends.
    let followed = 0
    const expectPlacementsHold = (
      input: readonly LoadedOverlay[],
      baseIds: readonly string[] | undefined
    ) => {
      const state: Resolution = createResolution(baseIds)
      for (const { overlay, reason } of surfaceOrder(input, surface, [])) {
        for (const check of overlay.ops) {
          if (!reason && check.status === "valid") {
            applyOp(state, { check, overlay }, scopeKeyOf(overlay))
          }
        }
      }
      const versionOf = (id: string, parent: string) => {
        const created = state.nodes.get(id)?.get("inserted")?.winner.op.check
          .op.op
        if (created === undefined) {
          return state.base.has(id) || id === parent ? 0 : undefined
        }
        return created === "insert" || created === "wrap"
          ? state.versions.get(id)
          : undefined
      }
      const holdingOf = (item: string) => {
        const placements = state.placements.get(item)
        return placements?.candidates.filter(
          ({ placement, version, followsBase }) =>
            followsBase === true ||
            (version !== undefined &&
              versionOf(placement.container, placements.origin) === version)
        )
      }
      const isRemoved = (id: string) => {
        const created = state.nodes.get(id)?.get("inserted")?.winner.op.check
          .op.op
        return (
          created !== undefined && created !== "insert" && created !== "wrap"
        )
      }
      const baseParent = (id: string) =>
        state.createdIn.get(id) ?? state.placements.get(id)?.origin
      const walk = (item: string) => {
        let node = baseParent(item)
        const seen = new Set<string>()
        while (node !== undefined && isRemoved(node) && !seen.has(node)) {
          seen.add(node)
          const held = holdingOf(node)?.at(-1)
          node =
            held && held.followsBase !== true
              ? held.placement.container
              : baseParent(node)
        }
        return node !== undefined && isRemoved(node) ? "@surface" : node
      }
      const resolved = resolve(input, baseIds ? { baseIds } : {})
      for (const [item, placements] of state.placements) {
        const held = holdingOf(item)?.at(-1)
        const settled = placementAt(resolved.placements, item)
        expect(settled?.winner?.check).toBe(held?.op.check)
        if (held?.followsBase) {
          followed++
          expect(settled?.placement.container).toBe(walk(item))
        } else if (settled?.winner) {
          expect(
            versionOf(settled.placement.container, placements.origin)
          ).toBeDefined()
        }
      }
    }

    it("accounts for every op once and ignores input order", () => {
      for (let seed = 1; seed <= 300; seed++) {
        const next = random(seed)
        const input = generate(next)
        const options = seed % 2 === 0 ? { baseIds: ["dashboard", "a"] } : {}
        const resolved = resolve(input, options)
        const applied = new Map<OpCheck, number>()
        for (const [item, placed] of resolved.placements) {
          const holder = get(resolved.properties, placed.container, "inserted")
            ?.winner.check.op
          expect(holder?.op).not.toBe("remove")
          if (
            placed.winner?.check.op.op === "wrap" &&
            placed.container === placed.winner.check.op.id
          ) {
            expect(holder).toBe(placed.winner.check.op)
            expect(placed.winner.check.op.items).toContain(item)
          }
          expect(new Set(placed.overridden).size).toBe(placed.overridden.length)
          for (const { check } of [
            ...(placed.winner ? [placed.winner] : []),
            ...placed.overridden,
          ]) {
            applied.set(check, 1)
          }
        }
        for (const node of resolved.properties.values()) {
          for (const { winner, overridden, breakpoints } of node.values()) {
            const ops = new Set([
              winner,
              ...overridden,
              ...(breakpoints?.values() ?? []),
            ])
            expect(new Set(overridden).size).toBe(overridden.length)
            expect(overridden).not.toContain(winner)
            for (const { check } of ops) {
              applied.set(check, (applied.get(check) ?? 0) + 1)
            }
          }
        }
        const count = (list: readonly { check: OpCheck }[], check: OpCheck) =>
          list.filter((op) => op.check === check).length
        for (const overlay of input) {
          for (const check of overlay.ops) {
            const skipped = count(resolved.skipped, check)
            const unapplied = count(resolved.unapplied, check)
            const isApplied = applied.has(check)
            const partial =
              check.status === "valid" &&
              check.op.op === "removeUserItem" &&
              resolved.unapplied.some(
                (op) => op.check === check && op.reason === "cross-layer-remove"
              )
            expect(skipped + unapplied + (isApplied ? 1 : 0)).toBe(
              partial && isApplied ? 2 : 1
            )
            if (check.status !== "valid") {
              expect(skipped).toBe(1)
            }
          }
        }
        expectPlacementsHold(input, options.baseIds)
        const shuffled: LoadedOverlay[] = []
        for (const overlay of input) {
          shuffled.splice(
            Math.floor(next() * (shuffled.length + 1)),
            0,
            overlay
          )
        }
        expect(canonical(resolve(shuffled, options))).toEqual(
          canonical(resolved)
        )
      }
      // The overlays must reach placements that follow the base.
      expect(followed).toBeGreaterThan(0)
    })
  })

  // Wall-clock budgets flake under load, so these compare 4n ops against n:
  // linear work grows about 4 times, quadratic work about 16 times.
  describe("in linear time", () => {
    const small = 8
    const large = 32

    const repeat = (
      count: number,
      layer: Layer,
      opAt: (index: number) => unknown
    ) => {
      const overlay = overlays()
      return Array.from({ length: count }, (_, overlayIndex) =>
        overlay(
          layer,
          Array.from({ length: 500 }, (_, index) =>
            opAt(overlayIndex * 500 + index)
          )
        )
      )
    }

    // Date.now() is coarse, so each sample averages runs over at least 50 ms.
    const sample = (run: () => void) => {
      const start = Date.now()
      let runs = 0
      while (Date.now() - start < 50) {
        run()
        runs++
      }
      return (Date.now() - start) / runs
    }

    // Timing flakes under load, so small and large runs alternate, each keeps
    // its fastest sample, and a slow attempt is retried. Linear work grows
    // about 4 times; quadratic work about 16 times, well above the bound.
    const expectLinearRuns = (small: () => void, large: () => void) => {
      small()
      large()
      let ratio = Infinity
      for (let attempt = 0; attempt < 5 && ratio >= 10; attempt++) {
        let fastestSmall = Infinity
        let fastestLarge = Infinity
        for (let round = 0; round < 3; round++) {
          fastestSmall = Math.min(fastestSmall, sample(small))
          fastestLarge = Math.min(fastestLarge, sample(large))
        }
        ratio = fastestLarge / fastestSmall
      }
      expect(ratio).toBeLessThan(10)
    }

    const expectLinear = (layer: Layer, opAt: (index: number) => unknown) => {
      const smallInput = repeat(small, layer, opAt)
      const largeInput = repeat(large, layer, opAt)
      expectLinearRuns(
        () => resolve(smallInput),
        () => resolve(largeInput)
      )
      return resolve(largeInput)
    }

    const cycle =
      (...ops: unknown[]) =>
      (index: number) =>
        ops[index % ops.length]

    it("resolves many ops on one property", () => {
      const resolved = expectLinear("personal", cycle(hide))
      expect(
        get(resolved.properties, notes, "visible")?.overridden
      ).toHaveLength(large * 500 - 1)
    })

    it("resolves many layout ops across breakpoints", () => {
      const resolved = expectLinear(
        "team",
        cycle(layout("grid", "lg"), layout("row"))
      )
      const property = get(resolved.properties, "dashboard", "layout")
      expect(property?.breakpoints?.size).toBe(2)
      expect(property?.overridden).toHaveLength(large * 500 - 2)
    })

    it("resolves many removals", () => {
      const resolved = expectLinear(
        "personal",
        cycle(derived("margin"), removeItem("margin"))
      )
      expect(resolved.unapplied).toEqual([])
      expect(
        get(resolved.properties, table, "derived.margin")?.overridden
      ).toHaveLength(large * 500 - 1)
    })

    it("resolves many wraps of moved items", () => {
      const resolved = expectLinear(
        "personal",
        cycle(
          { op: "move", target: "dashboard/slots/x", to: { into: "sidebar" } },
          {
            op: "wrap",
            target: "sidebar",
            id: "pair",
            items: ["x", "y"],
            mode: "row",
          }
        )
      )
      expect(resolved.unapplied).toEqual([])
      expect(placementAt(resolved.placements, "x")?.overridden).toHaveLength(
        large * 500 - 1
      )
    })

    it("resolves many nested wraps", () => {
      const wrap = (id: string, items: string[]) => ({
        op: "wrap",
        target: "dashboard",
        id,
        items,
        mode: "row",
      })
      const resolved = expectLinear(
        "personal",
        cycle(
          wrap("inner", ["a", "b"]),
          wrap("outer", ["inner", "c"]),
          { op: "span", target: "dashboard/slots/inner", columns: 2 },
          wrap("inner", ["b", "d"])
        )
      )
      expect(resolved.unapplied).toEqual([])
      expect(placementAt(resolved.placements, "inner")?.placement).toEqual({
        container: "outer",
        position: { index: 0 },
      })
      expect(placementAt(resolved.placements, "a")?.placement).toEqual({
        container: "dashboard",
      })
    })

    it("resolves many re-wraps", () => {
      const wrap = (items: string[]) => ({
        op: "wrap",
        target: "dashboard",
        id: "pair",
        items,
        mode: "row",
      })
      const resolved = expectLinear(
        "personal",
        cycle(
          { op: "pin", target: "dashboard/slots/a", where: "start" },
          wrap(["a", "b"]),
          wrap(["b", "a"]),
          wrap(["a", "c"]),
          wrap(["b", "c"])
        )
      )
      expect(resolved.unapplied).toEqual([])
      expect(placementAt(resolved.placements, "a")?.placement).toEqual({
        container: "dashboard",
        position: { pin: "start" },
      })
    })

    it("releases many wrappers holding moved and pinned items", () => {
      const resolved = expectLinear(
        "personal",
        cycle(
          wrapOp("dashboard", "w"),
          { op: "move", target: "dashboard/slots/c", to: { into: "w" } },
          { op: "pin", target: "w/slots/a", where: "end" },
          { op: "remove", target: "w" }
        )
      )
      expect(resolved.unapplied).toEqual([])
      expect(placementAt(resolved.placements, "c")?.placement).toEqual({
        container: "dashboard",
      })
    })

    describe("in steps, under a chain of removed nodes", () => {
      const insertAt = (target: string, id: string) => ({
        op: "insert",
        target,
        node: { id, kind: "chart", dataset: "orders" },
        at: { index: 0 },
      })
      const pin = (target: string) => ({ op: "pin", target, where: "start" })
      const chain = (
        size: number,
        inside: (size: number) => unknown[] = () => []
      ) => {
        const ops: unknown[] = [insertAt("dashboard", "n0")]
        for (let level = 1; level < size; level++) {
          ops.push(insertAt(`n${String(level - 1)}`, `n${String(level)}`))
        }
        ops.push(...inside(size))
        for (let level = 0; level < size; level++) {
          ops.push({ op: "remove", target: `n${String(level)}` })
        }
        return ops
      }
      const items = (
        size: number,
        op: (item: string, last: string) => unknown
      ) =>
        Array.from({ length: size }, (_, index) =>
          op(`y${String(index)}`, `n${String(size - 1)}`)
        )

      // Counts map reads, which every step of resolution makes, so the
      // scaling is measured exactly, not by time: 4n of the work reads about
      // 4 times as much when it is linear, 16 times when it is quadratic.
      // Only the ratio means anything; the counts themselves change with any
      // refactor.
      const reads = (input: LoadedOverlay[]) => {
        const spy = vi.spyOn(Map.prototype, "get")
        try {
          resolve(input)
          return spy.mock.calls.length
        } finally {
          spy.mockRestore()
        }
      }
      const expectLinearSteps = (build: (size: number) => unknown[]) => {
        const small = chunked(build(1000))
        const large = chunked(build(4000))
        expect(reads(large) / reads(small)).toBeLessThan(6)
        return resolve(large)
      }

      it("resolves many items created in the removed chain", () => {
        const { placements } = expectLinearSteps((size) =>
          chain(size, () => items(size, (item, last) => insertAt(last, item)))
        )
        expect(placements.get("y0")?.container).toBe("dashboard")
        expect(placements.size).toBe(4000)
      })

      it("resolves many pins on items under the removed chain", () => {
        const { placements } = expectLinearSteps((size) => [
          ...chain(size),
          ...items(size, (item, last) => pin(`${last}/slots/${item}`)),
        ])
        expect(placements.get("y0")?.container).toBe("dashboard")
      })

      it("resolves one item pinned many times under the removed chain", () => {
        const { placements } = expectLinearSteps((size) => [
          ...chain(size, () => [insertAt(`n${String(size - 1)}`, "y")]),
          ...items(size, (_, last) => pin(`${last}/slots/y`)),
        ])
        expect(placements.get("y")?.container).toBe("dashboard")
      })

      it("resolves many items created in the chain, then pinned", () => {
        const { placements } = expectLinearSteps((size) => [
          ...chain(size, () =>
            items(size, (item, last) => insertAt(last, item))
          ),
          ...items(size, (item) => pin(`dashboard/slots/${item}`)),
        ])
        expect(placements.get("y0")?.winner).toBeDefined()
        expect(placements.get("y0")?.container).toBe("dashboard")
      })

      it("resolves many moves into a live node from the removed chain", () => {
        const { placements } = expectLinearSteps((size) => [
          ...chain(size, () =>
            items(size, (item, last) => insertAt(last, item))
          ),
          ...items(size, (item, last) => ({
            op: "move",
            target: `${last}/slots/${item}`,
            to: { into: "dashboard" },
          })),
        ])
        expect(placements.get("y0")?.container).toBe("dashboard")
      })

      it("resolves many wraps of items from the removed chain", () => {
        const { placements } = expectLinearSteps((size) => [
          ...chain(size, () =>
            items(size, (item, last) => insertAt(last, item))
          ),
          ...items(size, (item) => ({
            op: "wrap",
            target: "dashboard",
            id: `w${item}`,
            items: [item, `z${item}`],
            mode: "row",
          })),
        ])
        expect(placements.get("y0")?.container).toBe("wy0")
      })
    })

    it("checks ids against many removed inserts and wrappers", () => {
      const target = (index: number) => `t${String(Math.floor(index / 4))}`
      const resolved = expectLinear("personal", (index) => {
        switch (index % 4) {
          case 0:
            return {
              op: "insert",
              target: target(index),
              node: { id: "c", kind: "chart", dataset: "orders" },
              at: { index: 0 },
            }
          case 1:
            return { op: "remove", target: `${target(index)}/slots/c` }
          case 2:
            return wrapOp("page", "c")
          default:
            return { op: "remove", target: "c" }
        }
      })
      expect(resolved.unapplied).toEqual([])
      expect(winner(resolved.properties, "c", "inserted")?.layer).toBe(
        "personal"
      )
    })
  })
})
