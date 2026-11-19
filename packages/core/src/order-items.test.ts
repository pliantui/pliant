import { describe, expect, it, vi } from "vitest"

import { orderItems } from "./order-items"
import type { PlacementPosition } from "./placement"

const items = ["a", "b", "c", "d", "e"]

function order(
  positions: Record<string, PlacementPosition>,
  base: readonly string[] = items
) {
  return orderItems(base, (item) => positions[item])
}

describe("orderItems", () => {
  it("keeps the base order without positions", () => {
    expect(order({})).toEqual(items)
  })

  it("moves an item before or after another", () => {
    expect(order({ e: { before: "b" } })).toEqual(["a", "e", "b", "c", "d"])
    expect(order({ a: { after: "d" } })).toEqual(["b", "c", "d", "a", "e"])
  })

  it("moves an item with the items anchored on it", () => {
    expect(order({ a: { after: "d" }, d: { before: "b" } })).toEqual([
      "d",
      "a",
      "b",
      "c",
      "e",
    ])
    expect(order({ a: { after: "b" }, b: { after: "e" } })).toEqual([
      "c",
      "d",
      "e",
      "b",
      "a",
    ])
  })

  it("keeps items anchored on the same item in base order", () => {
    expect(order({ d: { after: "a" }, c: { after: "a" } })).toEqual([
      "a",
      "c",
      "d",
      "b",
      "e",
    ])
    expect(order({ e: { before: "a" }, d: { before: "a" } })).toEqual([
      "d",
      "e",
      "a",
      "b",
      "c",
    ])
  })

  it("leaves an item in place when its anchor is unknown or itself", () => {
    expect(order({ b: { after: "z" }, c: { before: "c" } })).toEqual(items)
  })

  it("leaves a cycle of anchors in place", () => {
    expect(
      order({ a: { after: "c" }, c: { after: "a" }, e: { before: "a" } })
    ).toEqual(["e", "a", "b", "c", "d"])
  })

  it("resolves anchors on items whatever else happens to them", () => {
    expect(order({ a: { after: "e" }, e: { pin: "start" } })).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ])
  })

  it("places pinned items first or last", () => {
    expect(
      order({
        d: { pin: "start" },
        c: { pin: "start" },
        a: { pin: "end" },
        b: { pin: "none" },
        e: { pin: "sticky" },
      })
    ).toEqual(["c", "d", "b", "e", "a"])
  })

  it("places an item at an index among the unpinned items", () => {
    expect(order({ e: { index: 1 } })).toEqual(["a", "e", "b", "c", "d"])
    expect(order({ a: { index: 2 }, b: { pin: "start" } })).toEqual([
      "b",
      "c",
      "d",
      "a",
      "e",
    ])
    expect(order({ a: { index: 99 } })).toEqual(["b", "c", "d", "e", "a"])
  })

  it("places indexed items in index order, then base order", () => {
    expect(
      order({ e: { index: 0 }, d: { index: 0 }, a: { index: 3 } })
    ).toEqual(["d", "e", "b", "a", "c"])
  })

  it("keeps an indexed item's anchored items with it", () => {
    expect(
      order({ e: { index: 0 }, a: { after: "e" }, c: { index: 1 } })
    ).toEqual(["e", "a", "c", "b", "d"])
  })

  describe("items that don't render", () => {
    const renders = (item: string) => item !== "a" && item !== "c"
    const orderRendered = (positions: Record<string, PlacementPosition>) =>
      orderItems(items, (item) => positions[item], { renders })

    it("leaves them out", () => {
      expect(orderRendered({})).toEqual(["b", "d", "e"])
    })

    it("resolves anchors on them", () => {
      expect(orderRendered({ e: { after: "a" } })).toEqual(["e", "b", "d"])
      expect(orderRendered({ b: { before: "c" }, a: { index: 2 } })).toEqual([
        "b",
        "d",
        "e",
      ])
    })

    it("doesn't count them in an index", () => {
      expect(orderRendered({ e: { index: 1 } })).toEqual(["b", "e", "d"])
      expect(orderRendered({ e: { index: 0 }, d: { index: 1 } })).toEqual([
        "e",
        "d",
        "b",
      ])
      expect(orderRendered({ c: { pin: "start" }, e: { index: 0 } })).toEqual([
        "e",
        "b",
        "d",
      ])
    })
  })

  it("ignores promotion and duplicate items", () => {
    expect(order({ b: { promoted: true } }, ["a", "b", "a"])).toEqual([
      "a",
      "b",
    ])
  })

  it("reads each position once", () => {
    const positionOf = vi.fn(() => undefined)
    orderItems(items, positionOf)
    expect(positionOf).toHaveBeenCalledTimes(items.length)
  })

  describe("in linear steps", () => {
    const ids = (size: number) =>
      Array.from({ length: size }, (_, index) => `i${String(index)}`)

    // Counts map reads, as resolveLayers' scaling tests do: 4n items read
    // about 4 times as much when ordering is linear, 16 times when quadratic.
    const reads = (run: () => void) => {
      const spy = vi.spyOn(Map.prototype, "get")
      try {
        run()
        return spy.mock.calls.length
      } finally {
        spy.mockRestore()
      }
    }

    const expectLinear = (
      positions: (
        base: readonly string[]
      ) => (item: string) => PlacementPosition | undefined
    ) => {
      const run = (size: number) => {
        const base = ids(size)
        const positionOf = positions(base)
        return () => orderItems(base, positionOf)
      }
      expect(reads(run(16_000)) / reads(run(4000))).toBeLessThan(6)
    }

    it("orders a long chain of anchors", () => {
      expectLinear((base) => {
        const anchors = new Map(
          base.map((item, index) => [item, base[index + 1]])
        )
        return (item) => {
          const anchor = anchors.get(item)
          return anchor === undefined ? undefined : { after: anchor }
        }
      })
      const base = ids(100_000)
      const order = orderItems(base, (item) =>
        item === "i0"
          ? undefined
          : { before: `i${String(Number(item.slice(1)) - 1)}` }
      )
      expect(order[0]).toBe("i99999")
      expect(order.at(-1)).toBe("i0")
    })

    it("orders many items anchored on one", () => {
      expectLinear(
        () => (item) => (item === "i0" ? undefined : { after: "i0" })
      )
    })

    it("orders many indexed items", () => {
      expectLinear(
        () => (item) =>
          Number(item.slice(1)) % 2 === 0
            ? { index: Number(item.slice(1)) }
            : undefined
      )
    })

    it("orders a long cycle of anchors", () => {
      expectLinear((base) => {
        const anchors = new Map(
          base.map((item, index) => [item, base[(index + 1) % base.length]])
        )
        return (item) => ({ after: anchors.get(item) ?? "" })
      })
    })
  })
})
