import { describe, expect, it, vi } from "vitest"

import type { Layer } from "@pliantui/contract"

import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"
import { resolveRegion, type RegionEntry } from "./resolve-region"

const surface = "/dashboard"
const ulidDigits = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function overlayIds() {
  let count = 0
  return () => {
    const digits = Array.from({ length: 4 }, (_, place) => {
      const digit = Math.floor(count / ulidDigits.length ** (3 - place))
      return ulidDigits[digit % ulidDigits.length] ?? "0"
    }).join("")
    count++
    return `01JBQ3V8Z7XKQ2M4N5P6R7${digits}`
  }
}

function overlaysOf(ops: unknown[], layer: Layer = "personal") {
  const nextId = overlayIds()
  const overlays: LoadedOverlay[] = []
  for (let start = 0; start === 0 || start < ops.length; start += 500) {
    const result = loadOverlay({
      v: 1,
      id: nextId(),
      surface,
      layer,
      ...(layer === "team" && { scope: { team: "sales" } }),
      ops: ops.slice(start, start + 500),
      basis: { contract: 1, core: "0.1.0", manifests: {} },
      source: "manual",
      createdBy: "user_123",
      createdAt: "2026-11-01T09:30:00.000Z",
    })
    if (!result.success) {
      throw result.error
    }
    overlays.push(result.data)
  }
  return overlays
}

const dashboard = ["a", "b", "c", "d"]
const sidebar = ["s", "t"]
const mounted = ["page", "dashboard", "sidebar", ...dashboard, ...sidebar]

function layersOf(ops: unknown[]): ResolvedLayers {
  const layers = resolveLayers(ops.length ? overlaysOf(ops) : [], {
    surface,
    baseIds: { ids: mounted, source: "mounted" },
  })
  expect(layers.skipped).toEqual([])
  expect(layers.unapplied).toEqual([])
  return layers
}

function region(ops: unknown[], id = "dashboard", slots = dashboard) {
  return resolveRegion(layersOf(ops), { id, slots })
}

type Shape = string | Readonly<Record<string, readonly Shape[]>>

function shapeOf(entries: readonly RegionEntry[]): Shape[] {
  return entries.map((entry) =>
    entry.kind === "wrapper" ? { [entry.id]: shapeOf(entry.entries) } : entry.id
  )
}

function order(ops: unknown[], id = "dashboard", slots = dashboard) {
  return shapeOf(region(ops, id, slots).entries)
}

function entry(entries: readonly RegionEntry[], id: string) {
  return entries.find((candidate) => candidate.id === id)
}

const slot = (id: string, parent = "dashboard") => `${parent}/slots/${id}`
const move = (id: string, to: object, parent = "dashboard") => ({
  op: "move",
  target: slot(id, parent),
  to,
})
const pin = (id: string, where: string, parent = "dashboard") => ({
  op: "pin",
  target: slot(id, parent),
  where,
})
const hide = (id: string) => ({ op: "hide", target: slot(id) })
const insert = (id: string, at: object, target = "dashboard") => ({
  op: "insert",
  target,
  node: { id, kind: "stat", dataset: "orders" },
  at,
})
const wrap = (id: string, items: string[], target = "dashboard") => ({
  op: "wrap",
  target,
  id,
  items,
  mode: "grid",
  columns: 2,
})

describe("resolveRegion", () => {
  it("keeps the base order with no overlays", () => {
    const resolved = region([])

    expect(resolved).toEqual({
      layout: {},
      entries: dashboard.map((id) => ({ id, visible: true, kind: "slot" })),
    })
  })

  it("ignores a repeated slot id", () => {
    expect(order([], "dashboard", ["a", "b", "a"])).toEqual(["a", "b"])
  })

  describe("placements", () => {
    it("moves an item before or after another", () => {
      expect(order([move("a", { after: "c" })])).toEqual(["b", "c", "a", "d"])
      expect(order([move("d", { before: "b" })])).toEqual(["a", "d", "b", "c"])
    })

    it("moves an item to an index among the unpinned items", () => {
      expect(order([move("d", { index: 0 })])).toEqual(["d", "a", "b", "c"])
      expect(order([move("a", { index: 2 })])).toEqual(["b", "c", "a", "d"])
      expect(order([move("a", { index: 9 })])).toEqual(["b", "c", "d", "a"])
      expect(order([pin("c", "start"), move("d", { index: 0 })])).toEqual([
        "c",
        "d",
        "a",
        "b",
      ])
    })

    it("carries the items anchored to an item that moves", () => {
      expect(
        order([move("b", { after: "c" }), move("a", { after: "b" })])
      ).toEqual(["c", "b", "a", "d"])
      expect(
        order([move("b", { before: "a" }), move("a", { index: 3 })])
      ).toEqual(["c", "d", "b", "a"])
    })

    it("resolves anchors on hidden items", () => {
      const { entries } = region([hide("b"), move("d", { after: "b" })])

      expect(shapeOf(entries)).toEqual(["a", "b", "d", "c"])
      expect(entry(entries, "b")?.visible).toBe(false)
      expect(entry(entries, "d")?.visible).toBe(true)
    })

    it("resolves anchors on items placed in another node", () => {
      expect(
        order([move("b", { into: "sidebar" }), move("d", { after: "b" })])
      ).toEqual(["a", "d", "c"])
    })

    it("ignores an anchor that isn't in the region", () => {
      expect(order([move("a", { after: "zz" })])).toEqual(dashboard)
    })

    it("pins items at the start and end", () => {
      const { entries } = region([pin("c", "start"), pin("a", "end")])

      expect(shapeOf(entries)).toEqual(["c", "b", "d", "a"])
      expect(entry(entries, "c")?.pinned).toBe("start")
      expect(entry(entries, "a")?.pinned).toBe("end")
    })

    it("keeps a sticky item in its place", () => {
      const { entries } = region([pin("b", "sticky")])

      expect(shapeOf(entries)).toEqual(dashboard)
      expect(entry(entries, "b")?.pinned).toBe("sticky")
    })

    it("unpins with pin none", () => {
      const { entries } = region([pin("a", "end"), pin("a", "none")])

      expect(shapeOf(entries)).toEqual(dashboard)
      expect(entry(entries, "a")).not.toHaveProperty("pinned")
    })

    it("moves items out of and into regions", () => {
      const ops = [
        move("b", { into: "sidebar" }),
        move("d", { into: "sidebar" }),
        move("d", { before: "s" }, "sidebar"),
      ]

      expect(order(ops)).toEqual(["a", "c"])
      expect(order(ops, "sidebar", sidebar)).toEqual(["d", "s", "t", "b"])
    })

    it("puts an item moved back into its region at its base place", () => {
      expect(
        order([
          move("b", { into: "sidebar" }),
          move("b", { into: "dashboard" }),
        ])
      ).toEqual(dashboard)
    })
  })

  describe("ties", () => {
    it("orders items anchored to the same place by rank", () => {
      expect(
        order([move("d", { after: "a" }), move("c", { after: "a" })])
      ).toEqual(["a", "c", "d", "b"])
      expect(
        order([insert("y", { after: "a" }), insert("x", { after: "a" })])
      ).toEqual(["a", "x", "y", "b", "c", "d"])
    })

    it("orders items at the same index or pin by rank", () => {
      expect(order([move("d", { index: 0 }), move("c", { index: 0 })])).toEqual(
        ["c", "d", "a", "b"]
      )
      expect(order([pin("d", "start"), pin("b", "start")])).toEqual([
        "b",
        "d",
        "a",
        "c",
      ])
    })

    it("leaves items whose anchors form a cycle in place", () => {
      const ops = [
        move("a", { after: "c" }),
        move("c", { after: "a" }),
        move("d", { before: "a" }),
      ]

      expect(order(ops)).toEqual(["d", "a", "b", "c"])
      expect(order(ops.toReversed())).toEqual(["d", "a", "b", "c"])
    })

    it("falls back to an inserted node's own position", () => {
      expect(
        order([insert("x", { after: "b" }), move("x", { after: "zz" })])
      ).toEqual(["a", "b", "x", "c", "d"])
    })

    it("doesn't count nodes placed elsewhere in an index", () => {
      expect(
        order([move("a", { into: "sidebar" }), move("d", { index: 1 })])
      ).toEqual(["b", "d", "c"])
    })

    it("resolves anchors on a node created here and moved out", () => {
      const ops = [
        insert("x", { after: "a" }),
        move("d", { after: "x" }),
        move("x", { into: "sidebar" }),
      ]

      expect(order(ops)).toEqual(["a", "d", "b", "c"])
      expect(order(ops, "sidebar", sidebar)).toEqual(["s", "t", "x"])
    })
  })

  describe("inserted nodes and wrappers", () => {
    it("places an inserted node at its insert's position", () => {
      const { entries } = region([insert("x", { after: "b" })])

      expect(shapeOf(entries)).toEqual(["a", "b", "x", "c", "d"])
      expect(entry(entries, "x")).toEqual({
        id: "x",
        visible: true,
        kind: "inserted",
        node: { id: "x", kind: "stat", dataset: "orders" },
      })
      expect(order([insert("x", { index: 0 })])).toEqual([
        "x",
        "a",
        "b",
        "c",
        "d",
      ])
    })

    it("keeps an unpinned or sticky inserted node at its insert's position", () => {
      const ops = [insert("x", { after: "b" }), pin("x", "end")]

      expect(order([...ops, pin("x", "none")])).toEqual([
        "a",
        "b",
        "x",
        "c",
        "d",
      ])
      expect(order([...ops, pin("x", "sticky")])).toEqual([
        "a",
        "b",
        "x",
        "c",
        "d",
      ])
    })

    it("drops a removed node", () => {
      expect(
        order([insert("x", { after: "b" }), { op: "remove", target: "x" }])
      ).toEqual(dashboard)
    })

    it("puts an inserted node moved elsewhere last there", () => {
      const ops = [
        insert("x", { index: 0 }),
        { op: "move", target: slot("x"), to: { into: "sidebar" } },
      ]

      expect(order(ops)).toEqual(dashboard)
      expect(order(ops, "sidebar", sidebar)).toEqual(["s", "t", "x"])
    })

    it("resolves a wrapper in place of its first item", () => {
      const { entries } = region([wrap("w", ["c", "b"])])

      expect(shapeOf(entries)).toEqual(["a", { w: ["c", "b"] }, "d"])
      expect(entry(entries, "w")).toMatchObject({
        kind: "wrapper",
        visible: true,
        layout: { md: { mode: "grid", columns: 2 } },
      })
    })

    it("resolves nested wrappers and items moved into them", () => {
      expect(
        order([
          wrap("w", ["a", "b"]),
          wrap("v", ["w", "d"]),
          move("c", { into: "w" }),
          move("c", { index: 0 }),
        ])
      ).toEqual([{ v: [{ w: ["c", "a", "b"] }, "d"] }])
    })

    it("orders a wrapper by its items, which keep their place as anchors", () => {
      expect(
        order([
          wrap("w", ["c", "a", "b"]),
          move("a", { into: "sidebar" }),
          move("d", { into: "w" }),
          move("d", { after: "a" }),
        ])
      ).toEqual([{ w: ["c", "d", "b"] }])
    })

    it("returns a removed wrapper's items to their places", () => {
      expect(
        order([wrap("w", ["a", "b"]), { op: "remove", target: "w" }])
      ).toEqual(dashboard)
    })

    it("never renders the region inside itself", () => {
      const layers = layersOf([
        wrap("w", ["a", "b"]),
        { op: "move", target: "page/slots/dashboard", to: { into: "w" } },
      ])

      expect(
        shapeOf(
          resolveRegion(layers, { id: "dashboard", slots: dashboard }).entries
        )
      ).toEqual([{ w: ["a", "b"] }, "c", "d"])
    })

    it("puts a wrapper where its first item was shown", () => {
      expect(
        order([
          insert("x", { index: 0 }),
          insert("y", { after: "x" }),
          wrap("w", ["x", "y"]),
        ])
      ).toEqual([{ w: ["x", "y"] }, "a", "b", "c", "d"])
      expect(order([move("c", { index: 0 }), wrap("w", ["c", "d"])])).toEqual([
        { w: ["c", "d"] },
        "a",
        "b",
      ])
      expect(
        order([
          move("s", { into: "dashboard" }, "sidebar"),
          move("s", { index: 1 }),
          move("t", { into: "dashboard" }, "sidebar"),
          wrap("w", ["s", "t"]),
        ])
      ).toEqual(["a", { w: ["s", "t"] }, "b", "c", "d"])
    })

    it("puts a wrapper of items never shown here last", () => {
      expect(order([wrap("w", ["s", "t"])])).toEqual([
        "a",
        "b",
        "c",
        "d",
        { w: ["s", "t"] },
      ])
    })

    it("returns an item a re-wrap drops to its place", () => {
      expect(
        order([wrap("w", ["a", "b", "c"]), wrap("w", ["a", "b"])])
      ).toEqual([{ w: ["a", "b"] }, "c", "d"])
    })

    it("places a node inserted in a removed wrapper", () => {
      const removeW = { op: "remove", target: "w" }

      expect(
        order([
          wrap("w", ["b", "c"]),
          insert("x", { after: "c" }, "w"),
          removeW,
        ])
      ).toEqual(["a", "b", "c", "x", "d"])
      expect(
        order([wrap("w", ["b", "c"]), insert("x", { index: 0 }, "w"), removeW])
      ).toEqual(["a", "x", "b", "c", "d"])
    })

    it("replays an item's placements in the order they applied", () => {
      expect(
        order([
          move("a", { after: "d" }),
          wrap("w", ["b", "a", "c"]),
          insert("x", { after: "a" }, "w"),
          wrap("w", ["d", "b", "c"]),
        ])
      ).toEqual([{ w: ["d", "b", "c", "x"] }, "a"])
    })

    it("resolves deeply nested wrappers", () => {
      const depth = 10_000
      const slots = Array.from({ length: depth + 1 }, (_, i) => `s${String(i)}`)
      const ops = [
        wrap("w1", ["s0", "s1"]),
        ...Array.from({ length: depth - 1 }, (_, i) =>
          wrap(`w${String(i + 2)}`, [`w${String(i + 1)}`, `s${String(i + 2)}`])
        ),
      ]
      const layers = resolveLayers(overlaysOf(ops), {
        surface,
        baseIds: { ids: ["dashboard", ...slots], source: "mounted" },
      })
      let { entries } = resolveRegion(layers, { id: "dashboard", slots })
      let levels = 0
      for (
        let first = entries[0];
        first?.kind === "wrapper";
        first = entries[0]
      ) {
        levels++
        entries = first.entries
      }

      expect(levels).toBe(depth)
      expect(entries.map(({ id }) => id)).toEqual(["s0", "s1"])
    })
  })

  describe("known nodes", () => {
    const unknown = [
      { op: "move", target: slot("zz"), to: { index: 0 } },
      move("d", { after: "zz" }),
    ]

    it("drops a placed node that isn't known, keeping it as an anchor", () => {
      expect(order(unknown)).toEqual(["d", "a", "b", "c"])
      expect(order([...unknown, move("c", { index: 0 })])).toEqual([
        "c",
        "d",
        "a",
        "b",
      ])
    })

    it("renders every placed node without known ids", () => {
      const layers = resolveLayers(overlaysOf(unknown), { surface })

      expect(
        shapeOf(
          resolveRegion(layers, { id: "dashboard", slots: dashboard }).entries
        )
      ).toEqual(["zz", "d", "a", "b", "c"])
    })

    it("renders a wrapped item only when it is known or created", () => {
      expect(order([wrap("w", ["a", "zz"])])).toEqual([
        { w: ["a"] },
        "b",
        "c",
        "d",
      ])
      expect(order([insert("x", { index: 0 }), wrap("w", ["x", "a"])])).toEqual(
        [{ w: ["x", "a"] }, "b", "c", "d"]
      )

      const layers = resolveLayers(overlaysOf([wrap("w", ["s", "a"])]), {
        surface,
        baseIds: { ids: ["dashboard", ...dashboard], source: "mounted" },
      })
      expect(
        shapeOf(
          resolveRegion(layers, { id: "dashboard", slots: dashboard }).entries
        )
      ).toEqual([{ w: ["a"] }, "b", "c", "d"])
    })

    it("keeps a slot whose move into an unmounted node is dormant", () => {
      const layers = resolveLayers(overlaysOf([move("b", { into: "panel" })]), {
        surface,
        baseIds: { ids: mounted, source: "mounted" },
      })

      expect(layers.unapplied.map(({ reason }) => reason)).toEqual(["dormant"])
      expect(
        shapeOf(
          resolveRegion(layers, { id: "dashboard", slots: dashboard }).entries
        )
      ).toEqual(dashboard)
    })
  })

  describe("layout and collapse", () => {
    it("resolves layout and span per breakpoint", () => {
      const { layout, entries } = region([
        { op: "setLayout", target: "dashboard", mode: "grid", columns: 3 },
        { op: "setLayout", target: "dashboard", mode: "stack", at: "base" },
        {
          op: "setLayout",
          target: "dashboard",
          mode: "row",
          align: "between",
          at: "xl",
        },
        { op: "span", target: slot("a"), columns: 2, at: "lg" },
        { op: "span", target: slot("a"), columns: 3 },
      ])

      expect(layout).toEqual({
        base: { mode: "stack" },
        md: { mode: "grid", columns: 3 },
        xl: { mode: "row", align: "between" },
      })
      expect(Object.keys(layout)).toEqual(["base", "md", "xl"])
      expect(entry(entries, "a")?.span).toEqual({ md: 3, lg: 2 })
      expect(entry(entries, "b")).not.toHaveProperty("span")
    })

    it("lays out a wrapper from its wrap, then setLayout", () => {
      const { entries } = region([
        wrap("w", ["a", "b"]),
        { op: "setLayout", target: "w", mode: "stack", at: "lg" },
      ])

      expect(entry(entries, "w")).toMatchObject({
        layout: { md: { mode: "grid", columns: 2 }, lg: { mode: "stack" } },
      })
    })

    it("collapses items in place", () => {
      const { entries } = region([
        {
          op: "collapse",
          target: "dashboard",
          items: ["b", "c"],
          into: "more",
          label: "More",
        },
        { op: "collapse", target: "dashboard", items: ["c"], into: "tabs" },
      ])

      expect(shapeOf(entries)).toEqual(dashboard)
      expect(entry(entries, "b")?.collapsed).toEqual({
        into: "more",
        label: "More",
      })
      expect(entry(entries, "c")?.collapsed).toEqual({ into: "tabs" })
      expect(entry(entries, "a")).not.toHaveProperty("collapsed")
    })

    it("treats a collapse into an unknown value as not collapsed", () => {
      const layers = layersOf([
        { op: "collapse", target: "dashboard", items: ["b"], into: "more" },
      ])
      const property = layers.properties.get("dashboard")?.get("collapse.b")
      if (!property) {
        throw new Error("Expected a collapse")
      }
      const { check } = property.winner
      const none = {
        ...layers,
        properties: new Map([
          [
            "dashboard",
            new Map([
              [
                "collapse.b" as const,
                {
                  ...property,
                  winner: {
                    ...property.winner,
                    check: {
                      ...check,
                      op: Object.assign({}, check.op, { into: "none" }),
                    },
                  },
                },
              ],
            ]),
          ],
        ]),
      }

      expect(
        entry(
          resolveRegion(none, { id: "dashboard", slots: dashboard }).entries,
          "b"
        )
      ).not.toHaveProperty("collapsed")
    })
  })

  it("collapses a wrapper's items in the wrapper", () => {
    const { entries } = region([
      wrap("w", ["a", "b"]),
      { op: "collapse", target: "w", items: ["b"], into: "accordion" },
    ])
    const wrapper = entry(entries, "w")

    expect(
      wrapper?.kind === "wrapper" && entry(wrapper.entries, "b")?.collapsed
    ).toEqual({ into: "accordion" })
  })

  it("returns the same result for the same layers", () => {
    const layers = layersOf([wrap("w", ["a", "b"]), pin("c", "start")])
    const options = { id: "dashboard", slots: dashboard }

    expect(resolveRegion(layers, options)).toEqual(
      resolveRegion(layers, options)
    )
  })

  // Counts map reads, which every step makes, so the scaling is measured
  // exactly, not by time: 4n of the work reads about 4 times as much when it
  // is linear, 16 times when it is quadratic. Only the ratio means anything.
  it("scales linearly with the region's size", () => {
    const reads = (size: number) => {
      const slots = Array.from(
        { length: size },
        (_, index) => `s${String(index)}`
      )
      const ops = slots.flatMap((id, index) => {
        switch (index % 5) {
          case 0:
            return [move(id, { after: `s${String(index + 1)}` })]
          case 1:
            return [hide(id)]
          case 2:
            return [pin(id, index % 2 ? "start" : "end")]
          case 3:
            return [move(id, { index: size - index })]
          default:
            return [insert(`x${String(index)}`, { before: id })]
        }
      })
      const layers = resolveLayers(overlaysOf(ops), {
        surface,
        baseIds: { ids: ["dashboard", ...slots], source: "mounted" },
      })
      const spy = vi.spyOn(Map.prototype, "get")
      try {
        const { entries } = resolveRegion(layers, { id: "dashboard", slots })
        expect(entries).toHaveLength(size + size / 5)
        return spy.mock.calls.length
      } finally {
        spy.mockRestore()
      }
    }

    expect(reads(4000) / reads(1000)).toBeLessThan(6)
  })

  it("scales linearly with many regions and known ids", () => {
    const reads = (size: number) => {
      const regions = Array.from({ length: size }, (_, i) => `r${String(i)}`)
      const slotsOf = (r: string) => [`${r}-a`, `${r}-b`, `${r}-c`]
      const layers = resolveLayers(
        overlaysOf(regions.map((r) => move(`${r}-a`, { after: `${r}-c` }, r))),
        {
          surface,
          baseIds: {
            ids: [...regions, ...regions.flatMap(slotsOf)],
            source: "mounted",
          },
        }
      )
      const gets = vi.spyOn(Map.prototype, "get")
      const adds = vi.spyOn(Set.prototype, "add")
      try {
        for (const r of regions) {
          expect(
            resolveRegion(layers, { id: r, slots: slotsOf(r) }).entries
          ).toHaveLength(3)
        }
        return gets.mock.calls.length + adds.mock.calls.length
      } finally {
        gets.mockRestore()
        adds.mockRestore()
      }
    }

    expect(reads(4000) / reads(1000)).toBeLessThan(6)
  })

  it("scales linearly with many wrappers", () => {
    const reads = (size: number) => {
      const slots = Array.from({ length: size }, (_, i) => `s${String(i)}`)
      const ops = Array.from({ length: size / 2 }, (_, i) =>
        wrap(`w${String(i)}`, [`s${String(2 * i + 1)}`, `s${String(2 * i)}`])
      )
      const layers = resolveLayers(overlaysOf(ops), {
        surface,
        baseIds: { ids: ["dashboard", ...slots], source: "mounted" },
      })
      const spy = vi.spyOn(Map.prototype, "get")
      try {
        const { entries } = resolveRegion(layers, { id: "dashboard", slots })
        expect(entries).toHaveLength(size / 2)
        return spy.mock.calls.length
      } finally {
        spy.mockRestore()
      }
    }

    expect(reads(4000) / reads(1000)).toBeLessThan(6)
  })
})
