import { describe, expect, it } from "vitest"

import type { Op } from "@pliantui/contract"

import {
  compileTableState,
  type CompiledTableState,
  type FilterValue,
} from "./compile-table-state"
import { diffTableState, type DiffTableStateOptions } from "./diff-table-state"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers } from "./resolve-layers"

const table = "orders-table"
const columns = [
  "id",
  "customer",
  "region",
  "status",
  "value",
  "createdAt",
  "notes",
]

const column = (id: string) => `${table}/columns/${id}`

let sequence = 0

function overlay(layer: "team" | "session", ops: unknown[]): LoadedOverlay {
  sequence++
  const result = loadOverlay({
    v: 1,
    id: `01JBQ3V8Z7XKQ2M4N5P6R${String(sequence % 100000).padStart(5, "0")}`,
    surface: "/orders",
    layer,
    ...(layer === "team" && { scope: { team: "sales" } }),
    ops,
    basis: { contract: 1, core: "0.1.0", manifests: {} },
    source: "manual",
    createdBy: "user_123",
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, sequence)).toISOString(),
  })
  if (!result.success) {
    throw result.error
  }
  return result.data
}

function resolve(...layers: (readonly ["team" | "session", unknown[]])[]) {
  const resolved = resolveLayers(
    layers
      .filter(([, ops]) => ops.length > 0)
      .map(([layer, ops]) => overlay(layer, ops)),
    { surface: "/orders" }
  )
  expect(resolved.skipped).toEqual([])
  for (const ops of resolved.properties.values()) {
    for (const property of ops.values()) {
      expect(property.winner.check.status).toBe("valid")
    }
  }
  return resolved
}

function setup(
  lower: unknown[] = [],
  options: Partial<DiffTableStateOptions> = {},
  session: unknown[] = []
) {
  const all = { table, columns, ...options }
  const resolved = resolve(["team", lower], ["session", session])
  return {
    previous: compileTableState(resolved, all),
    diff: (next: Partial<CompiledTableState>) =>
      diffTableState(resolved, next, all),
    apply: (ops: readonly Op[]) =>
      compileTableState(
        resolve(["team", lower], ["session", session], ["session", [...ops]]),
        all
      ),
  }
}

describe("diffTableState", () => {
  it("makes no ops when nothing changed", () => {
    const { previous, diff } = setup([
      { op: "hide", target: column("notes") },
      { op: "move", target: column("notes"), to: { index: 0 } },
    ])
    expect(diff(previous)).toEqual({ ops: [], unmapped: [] })
    expect(diff({})).toEqual({ ops: [], unmapped: [] })
  })

  it("replaces the sort, leaving out unknown ids", () => {
    const { diff } = setup()
    expect(
      diff({
        sorting: [
          { id: "value", desc: true },
          { id: "missing", desc: false },
          { id: "id", desc: false },
        ],
      }).ops
    ).toEqual([
      {
        op: "setSort",
        target: table,
        sort: [
          { field: "value", dir: "desc" },
          { field: "id", dir: "asc" },
        ],
      },
    ])
  })

  it("clears a base sort with an empty one", () => {
    const base = { sorting: [{ id: "value", desc: true }] }
    const { diff, apply } = setup([], { base })
    const { ops } = diff({ sorting: [] })
    expect(ops).toEqual([{ op: "setSort", target: table, sort: [] }])
    expect(apply(ops).sorting).toEqual([])
  })

  it("hides and shows only the columns that changed", () => {
    const { diff } = setup([], { base: { columnVisibility: { notes: false } } })
    expect(
      diff({ columnVisibility: { notes: true, region: false, id: true } }).ops
    ).toEqual([
      { op: "hide", target: column("region") },
      { op: "show", target: column("notes") },
    ])
  })

  it("records one width, rounded and clamped", () => {
    const { diff } = setup([], {
      base: { columnSizing: { id: 80 } },
      sizeLimits: { value: { maxSize: 300 } },
    })
    expect(diff({ columnSizing: { id: 80, value: 412.6 } }).ops).toEqual([
      { op: "setColumnWidth", target: column("value"), width: 300 },
    ])
  })

  it("saves a reset width as the default size", () => {
    const { diff } = setup([
      { op: "setColumnWidth", target: column("notes"), width: 400 },
    ])
    expect(diff({ columnSizing: {} }).ops).toEqual([
      { op: "setColumnWidth", target: column("notes"), width: 150 },
    ])
    expect(
      setup([], { defaultSizes: { notes: 240 } }).diff({
        columnSizing: { notes: 241 },
      }).ops
    ).toEqual([{ op: "setColumnWidth", target: column("notes"), width: 241 }])
  })

  it("sets and clears filters, and lists raw values as unmapped", () => {
    const { diff, apply } = setup([], {
      base: { columnFilters: [{ id: "status", value: "paid" }] },
    })
    const between: FilterValue = { operator: "between", value: [10, 100] }
    const result = diff({
      columnFilters: [
        { id: "value", value: between },
        { id: "customer", value: "acme" },
      ],
    })
    expect(result).toEqual({
      ops: [
        {
          op: "setFilter",
          target: table,
          filter: { field: "value", operator: "between", value: [10, 100] },
        },
        { op: "clearFilter", target: table, field: "status" },
      ],
      unmapped: ["customer"],
    })
    expect(apply(result.ops).columnFilters).toEqual([
      { id: "value", value: between },
    ])
  })

  it("keeps an unchanged raw base filter without an op", () => {
    const base = { columnFilters: [{ id: "status", value: "paid" }] }
    const { diff } = setup([], { base })
    expect(
      diff({
        columnFilters: [
          { id: "status", value: "paid" },
          { id: "id", value: { operator: "isNull" } },
        ],
      })
    ).toEqual({
      ops: [
        {
          op: "setFilter",
          target: table,
          filter: { field: "id", operator: "isNull" },
        },
      ],
      unmapped: [],
    })
  })

  it("sets the page, with a size only when it isn't the base one", () => {
    const { diff } = setup([], {
      base: { pagination: { pageIndex: 0, pageSize: 25 } },
    })
    expect(diff({ pagination: { pageIndex: 2, pageSize: 25 } }).ops).toEqual([
      { op: "setPage", target: table, index: 2 },
    ])
    expect(diff({ pagination: { pageIndex: 0, pageSize: 5000 } }).ops).toEqual([
      { op: "setPage", target: table, index: 0, size: 1000 },
    ])
  })

  it("replaces the grouping", () => {
    const { diff } = setup([], { base: { grouping: ["status"] } })
    expect(diff({ grouping: [] }).ops).toEqual([
      { op: "setGroupBy", target: table, fields: [] },
    ])
  })

  it("pins and unpins columns, accepting the canonical order", () => {
    const { previous, diff, apply } = setup([
      { op: "pin", target: column("notes"), where: "start" },
    ])
    const { ops } = diff({
      columnPinning: { start: ["value", "id"], end: ["region"] },
    })
    expect(ops).toEqual([
      { op: "pin", target: column("id"), where: "start" },
      { op: "pin", target: column("region"), where: "end" },
      { op: "pin", target: column("value"), where: "start" },
      { op: "pin", target: column("notes"), where: "none" },
    ])
    expect(apply(ops).columnPinning).toEqual({
      start: ["id", "value"],
      end: ["region"],
    })
    expect(diff({ columnPinning: { start: ["notes"], end: [] } }).ops).toEqual(
      []
    )
    expect(previous.columnPinning.start).toEqual(["notes"])
  })

  it("moves the fewest columns to reorder", () => {
    const { diff, apply } = setup()
    const order = [
      "id",
      "value",
      "customer",
      "region",
      "status",
      "createdAt",
      "notes",
    ]
    const { ops } = diff({ columnOrder: order })
    expect(ops).toEqual([
      { op: "move", target: column("value"), to: { after: "id" } },
    ])
    expect(apply(ops).columnOrder).toEqual(order)
  })

  it("moves a column to the front before its new neighbour", () => {
    const { diff, apply } = setup()
    const order = [
      "notes",
      "id",
      "customer",
      "region",
      "status",
      "value",
      "createdAt",
    ]
    const { ops } = diff({ columnOrder: order })
    expect(ops).toEqual([
      { op: "move", target: column("notes"), to: { before: "id" } },
    ])
    expect(apply(ops).columnOrder).toEqual(order)
  })

  it("reorders around a lower layer's anchors", () => {
    const { diff, apply } = setup([
      { op: "move", target: column("notes"), to: { after: "id" } },
      { op: "move", target: column("status"), to: { after: "id" } },
    ])
    const order = [
      "id",
      "notes",
      "status",
      "customer",
      "region",
      "value",
      "createdAt",
    ]
    const { ops } = diff({ columnOrder: order })
    expect(ops).toHaveLength(1)
    expect(apply(ops).columnOrder).toEqual(order)
  })

  it("anchors before the next column when the previous one is taken", () => {
    const { diff, apply } = setup([
      { op: "move", target: column("region"), to: { after: "id" } },
    ])
    const order = [
      "id",
      "notes",
      "region",
      "customer",
      "status",
      "value",
      "createdAt",
    ]
    const { ops } = diff({ columnOrder: order })
    expect(ops).toEqual([
      { op: "move", target: column("notes"), to: { before: "region" } },
    ])
    expect(apply(ops).columnOrder).toEqual(order)
  })

  it("keeps a base-pinned column it unpins in its place", () => {
    const base = { columnPinning: { start: ["notes"], end: [] } }
    const { diff, apply } = setup([], { base })
    const { ops } = diff({ columnPinning: { start: [], end: [] } })
    expect(ops).toEqual([{ op: "pin", target: column("notes"), where: "none" }])
    expect(apply(ops).columnPinning).toEqual({ start: [], end: [] })
  })

  describe("round trip", () => {
    function random(seed: number) {
      let state = seed
      return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    function generator(next: () => number) {
      const int = (max: number) => Math.floor(next() * max)
      const pick = <T>(items: readonly T[]): T => {
        const item = items[int(items.length)]
        if (item === undefined) {
          throw new Error("Empty list")
        }
        return item
      }
      const some = <T>(items: readonly T[], chance = 0.3) =>
        items.filter(() => next() < chance)
      const shuffle = <T>(items: readonly T[]) =>
        items
          .map((item) => ({ item, key: next() }))
          .sort((a, b) => a.key - b.key)
          .map(({ item }) => item)
      const filter = (): FilterValue =>
        pick<FilterValue>([
          { operator: "eq", value: int(100) },
          { operator: "contains", value: "ac" },
          { operator: "between", value: [int(50), 50 + int(50)] },
          { operator: "isNull" },
          { operator: "in", value: ["paid", "overdue"] },
        ])
      return { int, pick, some, shuffle, filter }
    }

    function lowerOps(g: ReturnType<typeof generator>): unknown[] {
      return g.some(columns, 0.5).flatMap((id) =>
        g.pick([
          [{ op: g.pick(["hide", "show"]), target: column(id) }],
          [
            {
              op: "setColumnWidth",
              target: column(id),
              width: 16 + g.int(500),
            },
          ],
          [
            {
              op: "move",
              target: column(id),
              to: g.pick([
                { before: g.pick(columns) },
                { after: g.pick(columns) },
                { index: g.int(columns.length) },
              ]),
            },
          ],
          [
            {
              op: "pin",
              target: column(id),
              where: g.pick(["start", "end", "sticky", "none"]),
            },
          ],
          [
            {
              op: "setFilter",
              target: table,
              filter: { field: id, ...g.filter() },
            },
          ],
        ])
      )
    }

    function randomState(g: ReturnType<typeof generator>): CompiledTableState {
      const pinned = g.some(columns)
      const start = pinned.filter((_, index) => index % 2 === 0)
      return {
        sorting: g
          .some(columns, 0.2)
          .map((id) => ({ id, desc: g.int(2) === 1 })),
        columnVisibility: Object.fromEntries(
          g.some(columns).map((id) => [id, g.int(2) === 1])
        ),
        columnOrder: g.shuffle(columns),
        columnPinning: {
          start,
          end: pinned.filter((id) => !start.includes(id)),
        },
        columnSizing: Object.fromEntries(
          g.some(columns).map((id) => [id, 16 + g.int(800)])
        ),
        columnFilters: g.some(columns).map((id) => ({ id, value: g.filter() })),
        grouping: g.some(columns, 0.15),
        pagination: { pageIndex: g.int(5), pageSize: g.pick([10, 20, 50]) },
      }
    }

    function canonical(state: CompiledTableState) {
      const side = (id: string) =>
        state.columnPinning.start.includes(id)
          ? "start"
          : state.columnPinning.end.includes(id)
            ? "end"
            : "none"
      return {
        sorting: state.sorting,
        grouping: state.grouping,
        pagination: state.pagination,
        visible: columns.map((id) => state.columnVisibility[id] !== false),
        sizes: columns.map((id) => state.columnSizing[id] ?? 150),
        filters: Object.fromEntries(
          state.columnFilters.map(({ id, value }) => [id, value])
        ),
        sides: columns.map(side),
        center: [...new Set([...state.columnOrder, ...columns])].filter(
          (id) => side(id) === "none"
        ),
      }
    }

    it("compiles the diff back into the target state", () => {
      for (let seed = 1; seed <= 300; seed++) {
        const g = generator(random(seed))
        const base: Partial<CompiledTableState> = {
          sorting: g.some(columns, 0.2).map((id) => ({ id, desc: false })),
          columnVisibility: Object.fromEntries(
            g.some(columns).map((id) => [id, false])
          ),
          columnOrder: g.shuffle(columns),
          columnSizing: Object.fromEntries(
            g.some(columns).map((id) => [id, 40 + g.int(400)])
          ),
          grouping: g.some(columns, 0.1),
          pagination: { pageIndex: 0, pageSize: 20 },
        }
        const { diff, apply } = setup(lowerOps(g), { base }, [
          ...(g.int(2) === 1
            ? [{ op: "setPage", target: table, index: g.int(4) }]
            : []),
        ])
        const next = randomState(g)
        const { ops, unmapped } = diff(next)
        expect(unmapped).toEqual([])
        expect(canonical(apply(ops)), `seed ${String(seed)}`).toEqual(
          canonical(next)
        )
      }
    })
  })
})
