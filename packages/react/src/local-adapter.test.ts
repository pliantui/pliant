import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Overlay } from "@pliantui/contract"

import { localAdapter } from "./local-adapter"

const key = "pliant:/orders"

function overlay(id: string, width: number): Overlay {
  return {
    v: 1,
    id,
    surface: "/orders",
    layer: "personal",
    ops: [
      { op: "setColumnWidth", target: "orders-table/columns/total", width },
    ],
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("localAdapter", () => {
  it("saves personal versions per surface and loads them back", () => {
    const adapter = localAdapter()
    void adapter.save("/orders", overlay("01KAB0000000000000000000P1", 200))
    void adapter.save("/orders", overlay("01KAB0000000000000000000P2", 220))
    void adapter.save("/orders", overlay("01KAB0000000000000000000P1", 240))

    expect(adapter.load("/orders")).toEqual({
      personal: [
        overlay("01KAB0000000000000000000P2", 220),
        overlay("01KAB0000000000000000000P1", 240),
      ],
    })
    expect(adapter.load("/invoices")).toEqual({ personal: [] })
    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toMatchObject({
      v: 1,
    })
  })

  it("keeps saved entries it doesn't understand", () => {
    const unknown = { ...overlay("01KAB0000000000000000000P1", 200), extra: 1 }
    localStorage.setItem(key, JSON.stringify({ v: 1, personal: [7, unknown] }))
    const adapter = localAdapter()
    void adapter.save("/orders", overlay("01KAB0000000000000000000P2", 220))

    expect(adapter.load("/orders")).toEqual({
      personal: [7, unknown, overlay("01KAB0000000000000000000P2", 220)],
    })
  })

  it.each([
    ["JSON that doesn't parse", "{"],
    ["a value that isn't an object", "42"],
    ["a document without a version", JSON.stringify({ personal: [] })],
    [
      "personal overlays that aren't a list",
      JSON.stringify({ v: 1, personal: {} }),
    ],
    [
      "a document from an older version",
      JSON.stringify({
        v: 0,
        personal: [overlay("01KAB0000000000000000000P1", 200)],
      }),
    ],
  ])("loads %s as no overlays", (_name, value) => {
    localStorage.setItem(key, value)

    expect(localAdapter().load("/orders")).toEqual({ personal: [] })
  })

  it("saves over JSON that doesn't parse", () => {
    localStorage.setItem(key, "{")
    const adapter = localAdapter()
    void adapter.save("/orders", overlay("01KAB0000000000000000000P1", 200))

    expect(adapter.load("/orders")).toEqual({
      personal: [overlay("01KAB0000000000000000000P1", 200)],
    })
  })

  it("never overwrites data written by a newer version", () => {
    const newer = JSON.stringify({ v: 2, layers: [] })
    localStorage.setItem(key, newer)
    const adapter = localAdapter()

    expect(() =>
      adapter.save("/orders", overlay("01KAB0000000000000000000P1", 200))
    ).toThrow("written by a newer version of Pliant")
    expect(adapter.load("/orders")).toEqual({ personal: [] })
    expect(localStorage.getItem(key)).toBe(newer)
  })

  it("throws when storage is full", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError")
    })

    expect(() =>
      localAdapter().save("/orders", overlay("01KAB0000000000000000000P1", 200))
    ).toThrow("Storage is full")
  })
})
