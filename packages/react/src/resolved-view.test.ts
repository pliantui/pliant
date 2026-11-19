import { describe, expect, it } from "vitest"

import { loadOverlay, resolveLayers } from "@pliantui/core"

import { differingProperties, viewOf } from "./resolved-view"

function resolve(layer: string, ops: unknown[], extra: object = {}) {
  const result = loadOverlay({
    v: 1,
    id: "01KAB0000000000000000000P1",
    surface: "/orders",
    layer,
    ops,
    basis: { contract: 1, core: "0.0.0", manifests: {} },
    source: "manual",
    createdBy: "local",
    createdAt: "2026-11-19T00:00:00.000Z",
    ...extra,
  })
  if (!result.success) {
    throw new Error(result.error.message)
  }
  return resolveLayers([result.data], {
    surface: "/orders",
    baseIds: { ids: ["page", "a", "b"], source: "mounted" },
  })
}

const width = (value: number) => ({
  op: "setColumnWidth",
  target: "orders-table/columns/total",
  width: value,
})

describe("viewOf", () => {
  it("is the same for the same values from another layer", () => {
    expect([
      ...differingProperties(
        viewOf(resolve("personal", [width(200)])),
        viewOf(
          resolve("session", [width(200)], { id: "01KAB0000000000000000000S1" })
        )
      ),
    ]).toEqual([])
  })

  it("names the properties that differ", () => {
    expect([
      ...differingProperties(
        viewOf(resolve("session", [width(200), { op: "hide", target: "a" }])),
        viewOf(resolve("session", [width(300), { op: "hide", target: "a" }]))
      ),
    ]).toEqual([JSON.stringify(["orders-table/columns/total", "width"])])
  })

  it("counts placements and ops that don't apply", () => {
    const moved = { op: "move", target: "page/slots/a", to: { into: "box" } }

    expect([
      ...differingProperties(
        viewOf(resolve("session", [moved])),
        viewOf(
          resolve("session", [
            { op: "pin", target: "page/slots/b", where: "start" },
          ])
        )
      ),
    ]).toEqual(
      expect.arrayContaining([
        JSON.stringify(["a", "placement"]),
        JSON.stringify(["b", "placement"]),
      ]) as string[]
    )
  })
})
