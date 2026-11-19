import { describe, expect, it } from "vitest"

import { loadOverlay } from "@pliantui/core"

import { changeKeyOf, propertiesOf } from "./property-keys"

function keyOf(ops: unknown[]) {
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
    throw new Error(result.error.message)
  }
  return changeKeyOf(result.data)
}

const width = (value: number) => ({
  op: "setColumnWidth",
  target: "orders-table/columns/total",
  width: value,
})

const layout = (at: string) => ({
  op: "setLayout",
  target: "page",
  mode: "row",
  at,
})

describe("changeKeyOf", () => {
  it("is the same for ops that write the same properties", () => {
    expect(keyOf([width(200)])).toBe(keyOf([width(300)]))
    expect(keyOf([{ op: "hide", target: "a" }])).toBe(
      keyOf([{ op: "show", target: "page/slots/a" }])
    )
  })

  it("is undefined for ops that depend on history", () => {
    expect(
      keyOf([{ op: "move", target: "dashboard/slots/c", to: { into: "x" } }])
    ).toBeUndefined()
    expect(
      keyOf([width(200), { op: "pin", target: "page/slots/a", where: "start" }])
    ).toBeUndefined()
    expect(keyOf([{ op: "remove", target: "x" }])).toBeUndefined()
  })

  it("differs for other properties", () => {
    expect(keyOf([width(200)])).not.toBe(
      keyOf([width(200), { op: "hide", target: "a" }])
    )
  })

  it("differs for layouts at other breakpoints", () => {
    expect(keyOf([layout("sm")])).not.toBe(keyOf([layout("lg")]))
    expect(keyOf([layout("sm")])).toBe(keyOf([layout("sm")]))
  })

  it("is undefined when an op isn't valid", () => {
    expect(keyOf([{ op: "fromTheFuture", target: "x" }])).toBeUndefined()
  })
})

describe("propertiesOf", () => {
  it("ignores the breakpoint, since a higher layer replaces every one", () => {
    expect(
      propertiesOf({ op: "setLayout", target: "page", mode: "row", at: "sm" })
    ).toEqual(propertiesOf({ op: "setLayout", target: "page", mode: "stack" }))
  })
})
