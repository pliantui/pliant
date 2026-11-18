import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"

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
    surface = "/orders/[id]",
  }: OverlayOptions
): LoadedOverlay {
  const result = loadOverlay({
    v: 1,
    id,
    surface,
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
const chart = "dashboard/slots/revenue-chart"
const insertChart = {
  op: "insert",
  target: "dashboard",
  node: { id: "revenue-chart", kind: "chart", dataset: "orders" },
  at: { index: 0 },
}
const removeChart = { op: "remove", target: chart }
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
    expect(resolveLayers([])).toEqual({
      properties: new Map(),
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
      get(resolveLayers(input).properties, notes, "visible")

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
    const resolved = get(resolveLayers([personal]).properties, notes, "visible")

    expect(resolved?.winner.check).toBe(personal.ops[1])
    expect(resolved?.overridden[0]?.check).toBe(personal.ops[0])
  })

  describe("order within a layer", () => {
    const visible = (input: LoadedOverlay[], teamOrder?: string[]) =>
      get(resolveLayers(input, { teamOrder }).properties, notes, "visible")

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
    const { properties } = resolveLayers([team, personal])

    expect(winner(properties, "dashboard/slots/x", "placement")).toBe(team)
    expect(winner(properties, "dashboard/slots/y", "visible")).toBe(personal)
    expect(winner(properties, "@surface", "density")).toBe(team)
    expect(winner(properties, "dashboard", "layout")).toBe(personal)
  })

  describe("layout and span", () => {
    it("merges breakpoints within a layer, md when at is missing", () => {
      const overlay = overlays()
      const first = overlay("team", [layout("grid", "lg"), layout("row", "md")])
      const second = overlay("team", [layout("stack")])
      const resolved = get(
        resolveLayers([second, first]).properties,
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
        resolveLayers([support, sales]).properties,
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
        resolveLayers([personal, team]).properties,
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
      const resolved = get(
        resolveLayers([team, org]).properties,
        "dashboard/slots/a",
        "span"
      )

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
        get(resolveLayers([personal]).properties, notes, "visible")
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
    const { properties } = resolveLayers([team, personal])

    expect(winner(properties, "dashboard", "collapse.a")).toBe(personal)
    expect(winner(properties, "dashboard", "collapse.b")).toBe(team)
    expect(winner(properties, "dashboard", "collapse.c")).toBe(personal)
    expect(
      get(properties, "dashboard", "collapse.a")?.overridden[0]?.check
    ).toBe(team.ops[0])
  })

  it("shares one placement per item across structure and action ops", () => {
    const overlay = overlays()
    const x = "dashboard/slots/x"
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
    const { properties } = resolveLayers([team, personal])

    expect(get(properties, x, "placement")?.winner.check).toBe(personal.ops[1])
    expect(
      get(properties, x, "placement")?.overridden.map(({ check }) => check)
    ).toEqual([team.ops[0], personal.ops[0]])
    expect(winner(properties, "dashboard/slots/y", "placement")).toBe(team)
    expect(winner(properties, "toolbar/actions/export", "placement")).toBe(
      personal
    )
  })

  it("keeps original addresses after wrap and move", () => {
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
      { op: "move", target: chart, to: { index: 0 } },
    ])
    const personal = overlay("personal", [{ op: "hide", target: chart }])
    const { properties } = resolveLayers([team, personal])

    expect(winner(properties, "top-row", "inserted")).toBe(team)
    expect(properties.has("dashboard/slots/top-row")).toBe(false)
    expect(winner(properties, chart, "inserted")).toBe(team)
    expect(winner(properties, chart, "visible")).toBe(personal)
  })

  describe("user items", () => {
    it("keeps a separate id space per kind", () => {
      const overlay = overlays()
      const team = overlay("team", [derived("margin")])
      const personal = overlay("personal", [preset("margin"), derived("tax")])
      const override = overlay("personal", [derived("margin")])
      const { properties } = resolveLayers([team, personal])

      expect(winner(properties, table, "derived.margin")).toBe(team)
      expect(winner(properties, table, "preset.margin")).toBe(personal)
      expect(
        winner(
          resolveLayers([team, override]).properties,
          table,
          "derived.margin"
        )
      ).toBe(override)
    })

    it("removes the id in every kind the same layer added it to", () => {
      const overlay = overlays()
      const first = overlay("personal", [derived("margin"), preset("margin")])
      const second = overlay("personal", [removeItem("margin")])
      const { properties, unapplied } = resolveLayers([second, first])

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
      const { properties, unapplied } = resolveLayers([team, personal])

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
      const { properties, unapplied } = resolveLayers([personal, team])
      const resolved = get(properties, table, "derived.margin")

      expect(resolved?.winner.check).toBe(team.ops[0])
      expect(resolved?.overridden.map(({ check }) => check)).toEqual([
        personal.ops[0],
        personal.ops[1],
      ])
      expect(unapplied).toEqual([])
      expect(
        get(
          resolveLayers([team, personal, readd]).properties,
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
      const { properties, unapplied } = resolveLayers([personal, team])

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
      const { properties, unapplied } = resolveLayers([team, personal])

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
      const { properties, unapplied } = resolveLayers([second, first])

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
      const { properties, unapplied } = resolveLayers([support, sales])

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

      expect(resolveLayers([acme, beta]).unapplied[0]?.reason).toBe(
        "cross-layer-remove"
      )
    })

    it("falls back to a lower layer's node after a re-insert is removed", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const personal = overlay("personal", [insertChart, removeChart])
      const resolved = get(
        resolveLayers([personal, team]).properties,
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
      const { properties, unapplied } = resolveLayers([team, personal])

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
      const { properties, unapplied } = resolveLayers([team, personal])

      expect(get(properties, chart, "inserted")?.winner.check).toBe(team.ops[1])
      expect(unapplied).toEqual([])
    })

    it("doesn't remove a node a lower layer inserted", () => {
      const overlay = overlays()
      const team = overlay("team", [insertChart])
      const personal = overlay("personal", [removeChart])
      const { properties, unapplied } = resolveLayers([team, personal])

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
      const { properties, unapplied } = resolveLayers([personal])

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

    it("places an item moved into the target at its own address", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        moveX,
        wrap("sidebar", "pair", ["x", "y"]),
      ])
      const { properties } = resolveLayers([personal])

      expect(get(properties, x, "placement")?.winner.check).toBe(
        personal.ops[1]
      )
      expect(properties.has("sidebar/slots/x")).toBe(false)
      expect(
        get(properties, "sidebar/slots/y", "placement")?.winner.check
      ).toBe(personal.ops[1])
    })

    it("places an item wrapped into the target at its own address", () => {
      const overlay = overlays()
      const team = overlay("team", [wrap("dashboard", "top-row", ["x", "y"])])
      const personal = overlay("personal", [
        wrap("top-row", "inner", ["x", "z"]),
      ])
      const { properties } = resolveLayers([personal, team])

      expect(get(properties, x, "placement")?.winner.check).toBe(
        personal.ops[0]
      )
      expect(properties.has("top-row/slots/x")).toBe(false)
      expect(winner(properties, "top-row/slots/z", "placement")).toBe(personal)
    })

    it("uses the target's own slot once the item has moved on", () => {
      const overlay = overlays()
      const personal = overlay("personal", [
        moveX,
        { op: "move", target: x, to: { into: "footer" } },
        wrap("sidebar", "pair", ["x", "y"]),
      ])
      const { properties } = resolveLayers([personal])

      expect(get(properties, x, "placement")?.winner.check).toBe(
        personal.ops[1]
      )
      expect(winner(properties, "sidebar/slots/x", "placement")).toBe(personal)
    })

    describe("ids", () => {
      const collisions = (...input: LoadedOverlay[]) =>
        resolveLayers(input).unapplied.map(({ check, reason }) => [
          check,
          reason,
        ])

      it("rejects an id a base node has", () => {
        const overlay = overlays()
        const team = overlay("team", [
          { op: "hide", target: "dashboard/slots/orders" },
          wrap("dashboard", "orders", ["a", "b"]),
          wrap("dashboard", "a", ["a", "b"]),
          wrap("dashboard", "dashboard", ["a", "b"]),
        ])
        const personal = overlay("personal", [
          {
            op: "move",
            target: "page/slots/c",
            to: { into: "page/slots/sidebar" },
          },
        ])
        const org = overlay("org", [wrap("dashboard", "sidebar", ["a", "b"])])
        const { properties, unapplied } = resolveLayers([team, personal, org])

        expect(unapplied.map(({ check, reason }) => [check, reason])).toEqual([
          [org.ops[0], "id-collision"],
          [team.ops[1], "id-collision"],
          [team.ops[2], "id-collision"],
          [team.ops[3], "id-collision"],
        ])
        expect(properties.has("orders")).toBe(false)
        expect(properties.has("dashboard/slots/a")).toBe(false)
      })

      it("rejects an id an inserted node has, unless it was removed", () => {
        const overlay = overlays()
        const team = overlay("team", [
          insertChart,
          wrap("page", "revenue-chart", ["a", "b"]),
        ])
        const personal = overlay("personal", [
          insertChart,
          removeChart,
          wrap("page", "revenue-chart", ["a", "b"]),
        ])

        expect(collisions(team)).toEqual([[team.ops[1], "id-collision"]])
        expect(collisions(personal)).toEqual([])
      })

      it("rejects another scope's or target's wrap id, and allows replacing", () => {
        const overlay = overlays()
        const sales = overlay("team", [wrap("dashboard", "pair", ["a", "b"])])
        const support = overlay(
          "team",
          [wrap("dashboard", "pair", ["c", "d"])],
          {
            scope: "support",
          }
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
          get(resolveLayers([personal]).properties, "group", "inserted")?.winner
            .check
        ).toBe(personal.ops[1])
      })
    })
  })

  describe("overlays", () => {
    it("keeps the first of overlays with the same id", () => {
      const overlay = overlays()
      const id = "01JBQ3V8Z7XKQ2M4N5P6R7S8ZZ"
      const team = overlay("team", [hide], { id })
      const personal = overlay(
        "personal",
        [show, { op: "setTheme", target: notes }],
        { id }
      )
      const twin = overlay("team", [show], { id })

      for (const input of [
        [team, personal, twin],
        [twin, personal, team],
      ]) {
        const { properties, skipped } = resolveLayers(input)
        const kept = get(properties, notes, "visible")?.winner.overlay
        expect(kept === team || kept === twin).toBe(true)
        expect(
          skipped.map(({ overlay, reason }) => [overlay.layer, reason])
        ).toEqual([
          ["team", "duplicate-id"],
          ["personal", "duplicate-id"],
          ["personal", "duplicate-id"],
        ])
        expect(skipped[1]?.check).toBe(personal.ops[0])
      }
      expect(
        winner(resolveLayers([team, twin]).properties, notes, "visible")
      ).toBe(winner(resolveLayers([twin, team]).properties, notes, "visible"))
    })

    it("doesn't count an overlay for another surface as a duplicate", () => {
      const overlay = overlays()
      const id = "01JBQ3V8Z7XKQ2M4N5P6R7S8ZZ"
      const org = overlay("org", [hide])
      const other = overlay("team", [hide], { id, surface: "/invoices" })
      const personal = overlay("personal", [show], { id })
      const { properties, skipped } = resolveLayers([personal, other, org])

      expect(winner(properties, notes, "visible")).toBe(personal)
      expect(skipped).toEqual([
        { check: other.ops[0], overlay: other, reason: "surface-mismatch" },
      ])
    })

    it("skips overlays for another surface", () => {
      const overlay = overlays()
      const team = overlay("team", [hide])
      const other = overlay("personal", [show], { surface: "/invoices" })
      const app = overlay(
        "personal",
        [{ op: "setMotion", target: "@app", motion: "reduced" }],
        { surface: "@app" }
      )
      const { properties, skipped } = resolveLayers([app, other, team])

      expect(winner(properties, notes, "visible")).toBe(team)
      expect(winner(properties, "@app", "motion")).toBe(app)
      expect(skipped).toEqual([
        { check: other.ops[0], overlay: other, reason: "surface-mismatch" },
      ])
      expect(skipped[0]?.overlay).toBe(other)
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
    const fastest = (input: LoadedOverlay[]) => {
      resolveLayers(input)
      let best = Infinity
      for (let sample = 0; sample < 3; sample++) {
        const start = Date.now()
        let runs = 0
        while (Date.now() - start < 50) {
          resolveLayers(input)
          runs++
        }
        best = Math.min(best, (Date.now() - start) / runs)
      }
      return best
    }

    const expectLinear = (layer: Layer, opAt: (index: number) => unknown) => {
      const smallInput = repeat(small, layer, opAt)
      const largeInput = repeat(large, layer, opAt)
      let ratio = Infinity
      for (let attempt = 0; attempt < 3 && ratio >= 8; attempt++) {
        ratio = fastest(largeInput) / fastest(smallInput)
      }
      expect(ratio).toBeLessThan(8)
      return resolveLayers(largeInput)
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
      const x = "dashboard/slots/x"
      const resolved = expectLinear(
        "personal",
        cycle(
          { op: "move", target: x, to: { into: "sidebar" } },
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
      expect(get(resolved.properties, x, "placement")?.overridden).toHaveLength(
        large * 500 - 1
      )
      expect(resolved.properties.has("sidebar/slots/x")).toBe(false)
    })

    it("checks wrap ids against many removed inserts", () => {
      const target = (index: number) => `t${String(Math.floor(index / 3))}`
      const resolved = expectLinear("personal", (index) => {
        switch (index % 3) {
          case 0:
            return {
              op: "insert",
              target: target(index),
              node: { id: "c", kind: "chart", dataset: "orders" },
              at: { index: 0 },
            }
          case 1:
            return { op: "remove", target: `${target(index)}/slots/c` }
          default:
            return wrapOp("page", "c")
        }
      })
      expect(resolved.unapplied).toEqual([])
      expect(winner(resolved.properties, "c", "inserted")?.layer).toBe(
        "personal"
      )
    })
  })
})
