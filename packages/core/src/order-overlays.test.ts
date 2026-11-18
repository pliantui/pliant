import { describe, expect, it } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { orderOverlays } from "./order-overlays"

function overlay(
  layer: Layer,
  id: string,
  scope?: string,
  createdAt = "2026-11-01T09:30:00.000Z"
): LoadedOverlay {
  const result = loadOverlay({
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6R7S8${id}`,
    surface: "/orders/[id]",
    layer,
    ...(layer === "org" && { scope: { org: scope } }),
    ...(layer === "team" && { scope: { team: scope } }),
    ops: [{ op: "hide", target: "notes" }],
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

describe("orderOverlays", () => {
  const session = overlay("session", "A0")
  const personal = overlay("personal", "B0")
  const sales = overlay("team", "C0", "sales")
  const finance = overlay("team", "D0", "finance")
  const ops = overlay("team", "E0", "ops")
  const acme = overlay("org", "F0", "acme")
  const input = [session, personal, ops, sales, acme, finance]

  it("orders by layer, then teamOrder, then scope id", () => {
    expect(orderOverlays(input, ["ops", "finance"])).toEqual([
      acme,
      sales,
      finance,
      ops,
      personal,
      session,
    ])
    expect(orderOverlays(input, [])).toEqual([
      acme,
      finance,
      ops,
      sales,
      personal,
      session,
    ])
  })

  it("uses a team's first place in teamOrder", () => {
    expect(orderOverlays([sales, ops], ["ops", "sales", "ops"])).toEqual([
      sales,
      ops,
    ])
  })

  it("compares createdAt as instants, then ids", () => {
    const later = overlay("personal", "A1", undefined, "2026-11-01T10:00:00Z")
    const earlier = overlay(
      "personal",
      "B1",
      undefined,
      "2026-11-01T11:00:00+02:00"
    )
    const tie = overlay("personal", "C1", undefined, "2026-11-01T10:00:00Z")

    expect(orderOverlays([tie, later, earlier], [])).toEqual([
      earlier,
      later,
      tie,
    ])
  })

  it("doesn't change the input", () => {
    const copy = [...input]
    orderOverlays(input, ["sales"])
    expect(input).toEqual(copy)
  })
})
