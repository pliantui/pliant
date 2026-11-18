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

function expectOrder(
  actual: readonly LoadedOverlay[],
  expected: readonly LoadedOverlay[]
) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((overlay, index) => {
    expect(overlay).toBe(expected[index])
  })
}

function permutations<T>(items: readonly T[]): T[][] {
  return items.length <= 1
    ? [[...items]]
    : items.flatMap((item, index) =>
        permutations(items.toSpliced(index, 1)).map((rest) => [item, ...rest])
      )
}

describe("orderOverlays", () => {
  const session = overlay("session", "A0")
  const personal = overlay("personal", "B0")
  const sales = overlay("team", "C0", "sales")
  const finance = overlay("team", "D0", "finance")
  const ops = overlay("team", "E0", "ops")
  const acme = overlay("org", "F0", "acme")
  const input = [session, personal, ops, sales, acme, finance]

  it("orders by layer, then teamOrder, then ascending scope id", () => {
    expectOrder(orderOverlays(input, ["ops", "finance"]).flat(), [
      acme,
      sales,
      finance,
      ops,
      personal,
      session,
    ])
    expectOrder(orderOverlays(input, []).flat(), [
      acme,
      finance,
      ops,
      sales,
      personal,
      session,
    ])
  })

  it("uses a team's first place in teamOrder", () => {
    expectOrder(orderOverlays([sales, ops], ["ops", "sales", "ops"]).flat(), [
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

    expectOrder(orderOverlays([tie, later, earlier], []).flat(), [
      earlier,
      later,
      tie,
    ])
  })

  it("compares createdAt below a millisecond", () => {
    const at = (fraction: string, id: string) =>
      overlay("personal", id, undefined, `2026-11-01T10:00:00${fraction}Z`)
    const whole = at("", "D1")
    const nano = at(".000000001", "C1")
    const micro = at(".0000010", "B1")
    const milli = at(".001", "A1")

    expectOrder(orderOverlays([milli, micro, nano, whole], []).flat(), [
      whole,
      nano,
      micro,
      milli,
    ])
  })

  it("sorts an unreadable createdAt first, in any input order", () => {
    const valid = overlay("personal", "A1")
    const unreadable = { ...overlay("personal", "B1"), createdAt: "yesterday" }
    const other = { ...overlay("personal", "C1"), createdAt: "soon" }
    const late = overlay("personal", "D1", undefined, "2027-01-01T00:00:00Z")

    for (const order of permutations([valid, unreadable, other, late])) {
      expectOrder(orderOverlays(order, []).flat(), [
        unreadable,
        other,
        valid,
        late,
      ])
    }
  })

  it("groups overlays that tie on every key, ordered by content", () => {
    const first = overlay("personal", "A1")
    const second = { ...overlay("personal", "A1"), createdBy: "user_456" }
    const later = overlay("personal", "A1", undefined, "2026-11-02T00:00:00Z")

    for (const order of permutations([second, later, first])) {
      const groups = orderOverlays(order, [])
      expect(groups).toHaveLength(2)
      expectOrder(groups[0] ?? [], [first, second])
      expectOrder(groups[1] ?? [], [later])
    }
  })

  it("keeps identical tied overlays in input order", () => {
    const first = overlay("personal", "A1")
    const twin = overlay("personal", "A1")

    expectOrder(orderOverlays([twin, first], []).flat(), [twin, first])
    expectOrder(orderOverlays([first, twin], []).flat(), [first, twin])
  })

  it("doesn't change the input", () => {
    const copy = [...input]
    orderOverlays(input, ["sales"])
    expectOrder(input, copy)
  })
})
