import { describe, expect, it } from "vitest"

import type { Op } from "@pliantui/contract"

import {
  compileTableState,
  type CompiledTableState,
  type FilterValue,
} from "./compile-table-state"
import { diffTableState, type DiffTableStateOptions } from "./diff-table-state"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { resolveLayers, type ResolvedLayers } from "./resolve-layers"

// Stryker reruns every test that covers a mutant, for thousands of mutants,
// so under mutation testing (PLIANT_MUTATION, set by stryker.config.mjs) the
// generated cases are far fewer.
const mutating = process.env["PLIANT_MUTATION"] === "1"
const seeds = (count: number) => (mutating ? count / 10 : count)

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

function overlay(
  layer: "team" | "personal" | "session",
  ops: unknown[]
): LoadedOverlay {
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

  it("pins and unpins columns, accepting the canonical order, and keeps an unpinned column where the table showed it", () => {
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
      { op: "move", target: column("notes"), to: { before: "customer" } },
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
})

function expectValid(resolved: ResolvedLayers) {
  expect(resolved.skipped).toEqual([])
  for (const ops of resolved.properties.values()) {
    for (const property of ops.values()) {
      expect(property.winner.check.status).toBe("valid")
    }
  }
}

/** A table whose changes are applied as one session overlay each, on top. */
function history(
  options: Partial<DiffTableStateOptions> = {},
  team: unknown[] = []
) {
  const all = { table, columns, ...options }
  const overlays = team.length > 0 ? [overlay("team", team)] : []
  let resolved = resolveLayers(overlays, { surface: "/orders" })
  expectValid(resolved)
  return {
    get resolved() {
      return resolved
    },
    state: () => compileTableState(resolved, all),
    diff: (next: Partial<CompiledTableState>) =>
      diffTableState(resolved, next, all),
    apply(ops: readonly Op[]) {
      if (ops.length > 0) {
        overlays.push(overlay("session", [...ops]))
        resolved = resolveLayers(overlays, { surface: "/orders" })
        expectValid(resolved)
      }
      return compileTableState(resolved, all)
    },
  }
}

const centerOf = (
  state: Pick<CompiledTableState, "columnOrder" | "columnPinning">,
  ids: readonly string[] = columns
) =>
  [...new Set([...state.columnOrder, ...ids])].filter(
    (id) =>
      ids.includes(id) &&
      !state.columnPinning.start.includes(id) &&
      !state.columnPinning.end.includes(id)
  )

describe("diffTableState pinning", () => {
  const letters = ["a", "b", "c", "d", "e"]

  it("keeps the columns anchored on a newly pinned one in place", () => {
    const t = history({ columns: letters })
    t.apply(t.diff({ columnOrder: ["b", "c", "a", "d", "e"] }).ops)
    const { ops } = t.diff({ columnPinning: { start: ["c"], end: [] } })
    expect(ops).toHaveLength(2)
    expect(centerOf(t.apply(ops), letters)).toEqual(["b", "a", "d", "e"])
  })

  it("keeps a moved column in place when another is pinned to the end", () => {
    const t = history({ columns: letters })
    t.apply(t.diff({ columnOrder: ["e", "a", "b", "c", "d"] }).ops)
    const { ops } = t.diff({ columnPinning: { start: [], end: ["b"] } })
    expect(ops).toEqual([{ op: "pin", target: column("b"), where: "end" }])
    expect(centerOf(t.apply(ops), letters)).toEqual(["e", "a", "c", "d"])
  })

  it("unpins a column where the table shows it", () => {
    const t = history({ columns: letters })
    t.apply(t.diff({ columnPinning: { start: ["d"], end: [] } }).ops)
    const { ops } = t.diff({ columnPinning: { start: [], end: [] } })
    expect(ops).toEqual([
      { op: "move", target: column("d"), to: { before: "a" } },
    ])
    expect(centerOf(t.apply(ops), letters)).toEqual(["d", "a", "b", "c", "e"])
  })

  it("reorders around a base-pinned column it unpins", () => {
    const t = history({
      columns: letters,
      base: { columnPinning: { start: ["c"], end: [] } },
    })
    const { ops } = t.diff({
      columnPinning: { start: [], end: [] },
      columnOrder: ["c", "a", "b", "d", "e"],
    })
    expect(ops).toHaveLength(3)
    expect(ops).toContainEqual({
      op: "pin",
      target: column("c"),
      where: "none",
    })
    expect(centerOf(t.apply(ops), letters)).toEqual(["c", "a", "b", "d", "e"])
  })
})

function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generator(seed: number) {
  const next = random(seed)
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
  return { chance: next, int, pick, some, shuffle, filter }
}

type Generator = ReturnType<typeof generator>

function teamOps(g: Generator): unknown[] {
  return g.some(columns, 0.4).flatMap((id) =>
    g.pick([
      [{ op: g.pick(["hide", "show"]), target: column(id) }],
      [{ op: "setColumnWidth", target: column(id), width: 16 + g.int(500) }],
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

function baseOf(g: Generator): Partial<CompiledTableState> {
  const pinned = g.some(columns, 0.2)
  return {
    sorting: g.some(columns, 0.2).map((id) => ({ id, desc: false })),
    columnVisibility: Object.fromEntries(
      g.some(columns).map((id) => [id, false])
    ),
    columnOrder: g.some(g.shuffle(columns), 0.6),
    columnPinning: {
      start: pinned.filter((_, index) => index % 2 === 0),
      end: pinned.filter((_, index) => index % 2 === 1),
    },
    columnSizing: Object.fromEntries(
      g.some(columns).map((id) => [id, 40 + g.int(400)])
    ),
    columnFilters: g.some(columns, 0.2).map((id) => ({ id, value: "raw" })),
    grouping: g.some(columns, 0.1),
    pagination: { pageIndex: 0, pageSize: 20 },
  }
}

// A random state the table could report. Base-pinned columns it unpins
// keep their base order among themselves, the one thing the ops can't
// change (see `diffTableState`).
function stateOf(
  g: Generator,
  base: Partial<CompiledTableState>,
  previous: CompiledTableState
): CompiledTableState {
  const pinned = g.some(columns, 0.3)
  const start = pinned.filter((_, index) => index % 2 === 0)
  const end = pinned.filter((id) => !start.includes(id))
  const order = g.shuffle(columns)
  const basePinned = [
    ...(base.columnPinning?.start ?? []),
    ...(base.columnPinning?.end ?? []),
  ]
  const fixed = basePinned.filter((id) => !pinned.includes(id))
  const baseOrder = [...new Set([...(base.columnOrder ?? []), ...columns])]
  const fixedInOrder = baseOrder.filter((id) => fixed.includes(id))
  const columnOrder = order.map((id) =>
    fixed.includes(id) ? (fixedInOrder.shift() ?? id) : id
  )
  return {
    sorting: g.some(columns, 0.2).map((id) => ({ id, desc: g.int(2) === 1 })),
    columnVisibility: Object.fromEntries(
      g.some(columns).map((id) => [id, g.int(2) === 1])
    ),
    // A partial order lists the rest in definition order, which could put
    // those columns out of their base order.
    columnOrder:
      fixed.length === 0 && g.chance() < 0.3
        ? columnOrder.slice(0, 3)
        : columnOrder,
    columnPinning: { start, end },
    columnSizing: Object.fromEntries(
      g.some(columns).map((id) => [id, 16 + g.int(800)])
    ),
    columnFilters: [
      ...previous.columnFilters.filter(() => g.chance() < 0.5),
      ...g
        .some(columns, 0.2)
        .map((id) => ({ id, value: g.chance() < 0.2 ? "raw" : g.filter() })),
    ].filter(
      (filter, index, all) =>
        all.findIndex(({ id }) => id === filter.id) === index
    ),
    grouping: g.some(columns, 0.15).slice(0, 4),
    pagination: { pageIndex: g.int(5), pageSize: g.pick([10, 20, 50]) },
  }
}

function canonical(state: CompiledTableState, unmapped: readonly string[]) {
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
      state.columnFilters
        .filter(({ id }) => !unmapped.includes(id))
        .map(({ id, value }) => [id, value])
    ),
    sides: columns.map(side),
    center: centerOf(state),
  }
}

describe("diffTableState round trip", () => {
  it("compiles every diff of a chain back into its target", () => {
    for (let seed = 1; seed <= seeds(1000); seed++) {
      const g = generator(seed)
      const base = baseOf(g)
      const t = history({ base }, teamOps(g))
      for (let step = 0; step < 4; step++) {
        const previous = t.state()
        const kind = g.pick(["state", "pins", "drag"] as const)
        const label = `seed ${String(seed)}, step ${String(step)}, ${kind}`
        if (kind === "state") {
          const next = stateOf(g, base, previous)
          const { ops, unmapped } = t.diff(next)
          expect(
            unmapped.every((id) =>
              next.columnFilters.some(
                (filter) => filter.id === id && filter.value === "raw"
              )
            ),
            label
          ).toBe(true)
          const after = t.apply(ops)
          expect(canonical(after, unmapped), label).toEqual(
            canonical(
              {
                ...next,
                columnFilters: next.columnFilters.filter(
                  ({ id, value }) =>
                    value !== "raw" ||
                    previous.columnFilters.some(
                      (filter) => filter.id === id && filter.value === "raw"
                    )
                ),
              },
              unmapped
            )
          )
        } else if (kind === "pins") {
          const basePinned = [
            ...(base.columnPinning?.start ?? []),
            ...(base.columnPinning?.end ?? []),
          ]
          const toggled = g.pick(
            columns.filter((id) => !basePinned.includes(id))
          )
          const { start, end } = previous.columnPinning
          const columnPinning =
            start.includes(toggled) || end.includes(toggled)
              ? {
                  start: start.filter((id) => id !== toggled),
                  end: end.filter((id) => id !== toggled),
                }
              : g.chance() < 0.5
                ? { start: [...start, toggled], end }
                : { start, end: [...end, toggled] }
          const after = t.apply(t.diff({ columnPinning }).ops)
          expect(after.columnPinning, label).toEqual(
            compileTableState(t.resolved, {
              table,
              columns,
              base,
            }).columnPinning
          )
          expect(centerOf(after), label).toEqual(
            centerOf({ columnOrder: previous.columnOrder, columnPinning })
          )
        } else {
          // A column the base pins can't move without being pinned again.
          const center = centerOf(previous)
          const basePinned = [
            ...(base.columnPinning?.start ?? []),
            ...(base.columnPinning?.end ?? []),
          ]
          const draggable = center.filter((id) => !basePinned.includes(id))
          if (draggable.length === 0) {
            continue
          }
          const dragged = g.pick(draggable)
          const rest = center.filter((id) => id !== dragged)
          const at = g.int(rest.length + 1)
          const wanted = [...rest.slice(0, at), dragged, ...rest.slice(at)]
          const after = t.apply(t.diff({ columnOrder: wanted }).ops)
          expect(centerOf(after), label).toEqual(wanted)
        }
      }
    }
  }, 30_000)
})

describe("diffTableState moves", () => {
  // Columns anchored on `column`, which travel with it when it moves.
  function dependantsOf(resolved: ResolvedLayers, dragged: string) {
    return columns.filter((id) => {
      const position = resolved.placements.get(column(id))?.position
      return (
        position !== undefined &&
        (("before" in position && position.before === dragged) ||
          ("after" in position && position.after === dragged))
      )
    })
  }

  it("moves the dragged column, and only the columns anchored on it", () => {
    const counts = new Map<number, number>()
    let drags = 0
    let over = 0
    let free = 0
    let freeMore = 0
    for (let seed = 1; seed <= seeds(500); seed++) {
      const g = generator(seed)
      const t = history({ base: { columnOrder: g.shuffle(columns) } })
      for (let drag = 0; drag < 20; drag++) {
        const order = t.state().columnOrder
        const dragged = g.pick(order)
        const rest = order.filter((id) => id !== dragged)
        const at = g.int(rest.length + 1)
        const wanted = [...rest.slice(0, at), dragged, ...rest.slice(at)]
        if (wanted.join() === order.join()) {
          continue
        }
        const dependants = dependantsOf(t.resolved, dragged)
        const { ops } = t.diff({ columnOrder: wanted })
        const label = `seed ${String(seed)}, drag ${String(drag)}`
        expect(ops.length, label).toBeGreaterThan(0)
        if (dependants.length === 0) {
          free++
          freeMore += ops.length > 1 ? 1 : 0
        }
        drags++
        over += ops.length > 1 + dependants.length ? 1 : 0
        counts.set(ops.length, (counts.get(ops.length) ?? 0) + 1)
        expect(t.apply(ops).columnOrder, label).toEqual(wanted)
      }
    }
    // Columns anchored on the dragged one travel with it, and a few
    // histories (columns placed by index, whose place shifts when a column
    // before them moves) need more moves than re-anchoring those.
    expect(freeMore).toBeLessThan(free / 200)
    expect(over).toBeLessThan(drags / 50)
    expect(counts.get(1) ?? 0).toBeGreaterThan(drags * 0.69)
  }, 60_000)
})

describe("diffTableState on wide tables", () => {
  function wide(n: number, team: (ids: readonly string[]) => unknown[]) {
    const ids = Array.from({ length: n }, (_, index) => `c${String(index)}`)
    const options = { table, columns: ids }
    const ops = team(ids)
    const overlays = ops.length > 0 ? [overlay("team", ops)] : []
    const resolved = resolveLayers(overlays, { surface: "/orders" })
    const order = compileTableState(resolved, options).columnOrder
    return {
      order,
      diff(wanted: readonly string[]) {
        const started = Date.now()
        const result = diffTableState(
          resolved,
          { columnOrder: [...wanted] },
          options
        )
        const elapsed = Date.now() - started
        const after = compileTableState(
          resolveLayers(
            [
              ...overlays,
              ...(result.ops.length > 0
                ? [overlay("session", result.ops)]
                : []),
            ],
            { surface: "/orders" }
          ),
          options
        )
        expect(after.columnOrder).toEqual(wanted)
        return { ops: result.ops, elapsed }
      },
    }
  }

  // Each of these takes about 1 to 15 ms on a dev machine. The bound leaves
  // room for slow, busy CI runners, where scheduling and garbage collection
  // pauses add tens of milliseconds, while catching a search that grows much
  // faster than the table, as the greedy one did (9 s to reverse 60 columns). Stryker's
  // mutation testing instruments every branch, which slows the search
  // several times over, so the bound is looser there.
  const frame = mutating ? 1000 : 200

  const chained = (ids: readonly string[]) =>
    ids.slice(1).map((id, index) => ({
      op: "move",
      target: column(id),
      to: { before: ids[index] },
    }))

  it.each([100, 150])("reorders %i columns within the bound", (n) => {
    const g = generator(n)
    const t = wide(n, () => [])
    const shapes: [string, string[]][] = [
      ["reverse", t.order.toReversed()],
      ["shuffle", g.shuffle(t.order)],
      ["rotate", [...t.order.slice(10), ...t.order.slice(0, 10)]],
      ["swap pairs", t.order.map((id, index) => t.order[index ^ 1] ?? id)],
    ]
    for (const [shape, wanted] of shapes) {
      expect(t.diff(wanted).elapsed, shape).toBeLessThan(frame)
    }
  })

  it.each([100, 150])(
    "drags a column of %i that a team chained together within the bound",
    (n) => {
      const t = wide(n, chained)
      for (const [from, to] of [
        [3, n - 5],
        [n - 2, 1],
        [n >> 1, 0],
      ] as const) {
        const dragged = t.order[from] ?? ""
        const rest = t.order.filter((id) => id !== dragged)
        const { ops, elapsed } = t.diff([
          ...rest.slice(0, to),
          dragged,
          ...rest.slice(to),
        ])
        expect(elapsed).toBeLessThan(frame)
        expect(ops.length).toBeLessThanOrEqual(2)
      }
    }
  )

  it.each([
    ["before", 10],
    ["before", 20],
    ["before", 30],
    ["before", 100],
    ["after", 10],
    ["after", 30],
    ["after", 100],
  ] as const)(
    "moves at most 2 columns to drag one of a chain anchored %s, %i long",
    (side, n) => {
      const t = wide(n, (ids) =>
        ids.slice(1).map((id, index) => ({
          op: "move",
          target: column(id),
          to:
            side === "before" ? { before: ids[index] } : { after: ids[index] },
        }))
      )
      const step = (n > 30 ? 9 : n === 30 ? 2 : 1) * (mutating ? 3 : 1)
      for (let from = 0; from < n; from += step) {
        for (let at = 0; at < n; at += step) {
          const dragged = t.order[from] ?? ""
          const rest = t.order.filter((id) => id !== dragged)
          const wanted = [...rest.slice(0, at), dragged, ...rest.slice(at)]
          if (wanted.join() !== t.order.join()) {
            expect(t.diff(wanted).ops.length).toBeLessThanOrEqual(2)
          }
        }
      }
    },
    60_000
  )

  it("rarely needs many more moves than the columns riding on the dragged one", () => {
    const n = 30
    const ids = Array.from({ length: n }, (_, index) => `c${String(index)}`)
    const options = { table, columns: ids }
    let drags = 0
    let moves = 0
    let many = 0
    for (let seed = 1; seed <= seeds(60); seed++) {
      const g = generator(seed * 31 + n)
      const team = g
        .some(ids)
        .map((id) => ({
          op: "move",
          target: column(id),
          to: g.pick([
            { before: g.pick(ids) },
            { after: g.pick(ids) },
            { index: g.int(n) },
          ]),
        }))
        .filter(
          ({ target, to }) => !Object.values(to).includes(target.slice(21))
        )
      const overlays = team.length > 0 ? [overlay("team", team)] : []
      let resolved = resolveLayers(overlays, { surface: "/orders" })
      for (let drag = 0; drag < 20; drag++) {
        const order = compileTableState(resolved, options).columnOrder
        const dragged = g.pick(order)
        const rest = order.filter((id) => id !== dragged)
        const at = g.int(rest.length + 1)
        const wanted = [...rest.slice(0, at), dragged, ...rest.slice(at)]
        if (wanted.join() === order.join()) {
          continue
        }
        const riding = ids.filter((id) => {
          const position = resolved.placements.get(column(id))?.position
          return (
            position !== undefined &&
            (("before" in position && position.before === dragged) ||
              ("after" in position && position.after === dragged))
          )
        }).length
        const { ops } = diffTableState(
          resolved,
          { columnOrder: wanted },
          options
        )
        drags++
        moves += ops.length
        many += ops.length > 4 + riding ? 1 : 0
        overlays.push(overlay("session", ops))
        resolved = resolveLayers(overlays, { surface: "/orders" })
        expect(compileTableState(resolved, options).columnOrder).toEqual(wanted)
      }
    }
    // The search this replaced, which tried every anchor of every column,
    // averaged 1.74 moves on these drags; this one about 1.71. Columns
    // placed by index shift when the dragged one passes them, so some drags
    // need a few more moves than the columns riding on it.
    expect(moves / drags).toBeLessThan(1.9)
    expect(many).toBeLessThan(drags / 100)
  }, 60_000)
})
