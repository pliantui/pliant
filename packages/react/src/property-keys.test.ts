import { describe, expect, it } from "vitest"

import { loadOverlay } from "@pliantui/core"

import { propertyKeysOf } from "./property-keys"

function keysOf(ops: unknown[]) {
  const result = loadOverlay({
    v: 1,
    id: "01KAB0000000000000000000P1",
    surface: "/orders",
    layer: "personal",
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
  })
  if (!result.success) {
    throw result.error
  }
  return propertyKeysOf(result.data, "/orders")
}

const width = (value: number) => ({
  op: "setColumnWidth",
  target: "orders-table/columns/total",
  width: value,
})

describe("propertyKeysOf", () => {
  it("is the same for ops that write the same properties", () => {
    expect(keysOf([width(200)])).toBe(keysOf([width(300)]))
    expect(keysOf([{ op: "hide", target: "a" }])).toBe(
      keysOf([{ op: "show", target: "page/slots/a" }])
    )
  })

  it("differs for other properties", () => {
    expect(keysOf([width(200)])).not.toBe(
      keysOf([width(200), { op: "hide", target: "a" }])
    )
    expect(
      keysOf([{ op: "pin", target: "page/slots/a", where: "start" }])
    ).not.toBe(keysOf([{ op: "hide", target: "a" }]))
  })

  it("differs for layouts at other breakpoints", () => {
    const layout = (at: string) => ({
      op: "setLayout",
      target: "page",
      mode: "row",
      at,
    })

    expect(keysOf([layout("sm")])).not.toBe(keysOf([layout("lg")]))
    expect(keysOf([layout("sm")])).toBe(keysOf([layout("sm")]))
  })

  it("is undefined when an op doesn't apply on its own", () => {
    expect(keysOf([{ op: "remove", target: "x" }])).toBeUndefined()
    expect(keysOf([{ op: "fromTheFuture", target: "x" }])).toBeUndefined()
  })
})
