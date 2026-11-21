import { describe, expect, it } from "vitest"

import { loadOverlay } from "./load-overlay"
import { resolveLayers, type ResolveLayersOptions } from "./resolve-layers"
import { resolveNav } from "./resolve-nav"

const surface = "app-shell"
const items = ["inbox", "tickets", "customers", "reports"]

function overlay(ops: unknown[], layer: string, id: string) {
  const loaded = loadOverlay({
    v: 1,
    id,
    surface,
    layer,
    ...(layer === "team" && { scope: { team: "support" } }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: "2026-11-01T09:30:00.000Z",
  })
  if (!loaded.success) {
    throw loaded.error
  }
  return loaded.data
}

function resolve(
  ops: unknown[],
  options: Partial<ResolveLayersOptions> & { team?: unknown[] } = {}
) {
  const { team = [], ...rest } = options
  const overlays = [
    ...(team.length > 0
      ? [overlay(team, "team", "01JBQ3V8Z7XKQ2M4N5P6R70001")]
      : []),
    ...(ops.length > 0
      ? [overlay(ops, "personal", "01JBQ3V8Z7XKQ2M4N5P6R70000")]
      : []),
  ]
  const layers = resolveLayers(overlays, {
    surface,
    teamOrder: ["support"],
    ...rest,
  })
  return resolveNav(layers, { id: "app-sidebar", items })
}

const order = (ops: unknown[]) => resolve(ops).entries.map((entry) => entry.id)

describe("resolveNav", () => {
  it("renders every item in base order, visible, with no landing", () => {
    const nav = resolve([])
    expect(nav.entries).toEqual(
      items.map((id) => ({ kind: "slot", id, visible: true }))
    )
    expect(nav.landing).toBeUndefined()
  })

  it("moves and pins items within the nav", () => {
    expect(
      order([
        {
          op: "move",
          target: "app-sidebar/items/reports",
          to: { before: "inbox" },
        },
      ])
    ).toEqual(["reports", "inbox", "tickets", "customers"])
    expect(
      order([{ op: "pin", target: "app-sidebar/items/inbox", where: "end" }])
    ).toEqual(["tickets", "customers", "reports", "inbox"])
    expect(
      resolve([{ op: "pin", target: "app-sidebar/items/inbox", where: "end" }])
        .entries[3]
    ).toEqual({ kind: "slot", id: "inbox", visible: true, pinned: "end" })
  })

  it("ignores ops on other navs and on ids that aren't items", () => {
    expect(
      order([
        {
          op: "move",
          target: "other-nav/items/reports",
          to: { before: "inbox" },
        },
        { op: "move", target: "app-sidebar/items/x", to: { before: "inbox" } },
        { op: "hide", target: "other-nav/items/inbox" },
      ])
    ).toEqual(items)
    expect(
      resolve([{ op: "hide", target: "other-nav/items/inbox" }]).entries[0]
    ).toEqual({ kind: "slot", id: "inbox", visible: true })
  })

  it("keeps hidden items in place, and collapses items in place", () => {
    const nav = resolve([
      { op: "hide", target: "app-sidebar/items/tickets" },
      {
        op: "collapse",
        target: "app-sidebar",
        items: ["reports"],
        into: "more",
      },
    ])
    expect(nav.entries).toEqual([
      { kind: "slot", id: "inbox", visible: true },
      { kind: "slot", id: "tickets", visible: false },
      { kind: "slot", id: "customers", visible: true },
      {
        kind: "slot",
        id: "reports",
        visible: true,
        collapsed: { into: "more" },
      },
    ])
  })

  it("reads the landing item", () => {
    expect(
      resolve([{ op: "setLanding", target: "app-sidebar/items/reports" }])
        .landing
    ).toBe("reports")
    expect(
      resolve([
        { op: "setLanding", target: "shell/slots/app-sidebar/items/tickets" },
      ]).landing
    ).toBe("tickets")
  })

  it("lets a higher layer's landing win", () => {
    expect(
      resolve([{ op: "setLanding", target: "app-sidebar/items/reports" }], {
        team: [{ op: "setLanding", target: "app-sidebar/items/tickets" }],
      }).landing
    ).toBe("reports")
    expect(
      resolve([], {
        team: [{ op: "setLanding", target: "app-sidebar/items/tickets" }],
      }).landing
    ).toBe("tickets")
  })

  it("has no landing on an item that is hidden or isn't in items", () => {
    expect(
      resolve([
        { op: "setLanding", target: "app-sidebar/items/reports" },
        { op: "hide", target: "app-sidebar/items/reports" },
      ]).landing
    ).toBeUndefined()
    expect(
      resolve([{ op: "setLanding", target: "app-sidebar/items/archive" }])
        .landing
    ).toBeUndefined()
    expect(
      resolve([{ op: "setLanding", target: "other-nav/items/reports" }]).landing
    ).toBeUndefined()
  })

  it("lands on a collapsed item, which stays reachable", () => {
    expect(
      resolve([
        { op: "setLanding", target: "app-sidebar/items/reports" },
        {
          op: "collapse",
          target: "app-sidebar",
          items: ["reports"],
          into: "more",
        },
      ]).landing
    ).toBe("reports")
  })

  it("keeps critical items visible", () => {
    const nav = resolve([{ op: "hide", target: "app-sidebar/items/inbox" }], {
      flags: { "app-sidebar/items/inbox": { critical: true } },
    })
    expect(nav.entries[0]).toEqual({ kind: "slot", id: "inbox", visible: true })
  })
})
