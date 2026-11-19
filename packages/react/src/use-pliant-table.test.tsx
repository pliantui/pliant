import { useLayoutEffect, useState } from "react"
import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  functionalUpdate,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type Row,
  type SortingState,
  type TableOptions,
} from "@tanstack/react-table"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as z from "zod"

import type { Op, Overlay } from "@pliantui/contract"
import type { OpPropertyKey, ResolvedLayers } from "@pliantui/core"

import type { PliantStore } from "./layer-store"
import { PliantRoot } from "./pliant-root"
import type { StorageAdapter } from "./storage-adapter"
import { usePliantStore } from "./use-pliant-store"
import { usePliantTable, type UsePliantTableOptions } from "./use-pliant-table"
import { useResolved } from "./use-resolved"

const surface = "/orders"
const tableId = "orders-table"

interface Order {
  id: string
  customer: string
  status: string | null
  value: number
}

const data: Order[] = Array.from({ length: 25 }, (_, index) => ({
  id: `o${String(index + 1).padStart(2, "0")}`,
  customer: ["Acme", "Globex", "Initech"][index % 3] ?? "",
  status: [null, "paid", "overdue", "pending"][index % 4] ?? null,
  value: (index * 37) % 100,
}))

const sortCalls = vi.fn()

const features = tableFeatures({
  columnFilteringFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
})

type Features = typeof features

const helper = createColumnHelper<Features, Order>()

const columns = helper.columns([
  helper.accessor("id", {}),
  helper.accessor("customer", {
    filterFn: (row: Row<Features, Order>, id: string, value: unknown) =>
      Array.isArray(value) && value.includes(row.getValue(id)),
    meta: { pliant: { filterValue: z.array(z.string()).min(1) } },
  }),
  helper.accessor("status", {}),
  helper.accessor("value", {
    sortFn: (a: Row<Features, Order>, b: Row<Features, Order>) => {
      sortCalls()
      return a.original.value - b.original.value
    },
  }),
])

interface Harness {
  store: PliantStore
  resolved: ResolvedLayers
  table: ReturnType<typeof useTable<Features, Order>>
}

function memoryAdapter() {
  const saved: Overlay[] = []
  const storage: StorageAdapter = {
    load: () => ({}),
    save: (_surface, overlay) => {
      saved.push(overlay)
    },
  }
  return { storage, saved }
}

function setup(
  options: Partial<TableOptions<Features, Order>> = {},
  config: Partial<UsePliantTableOptions> = {},
  onError?: (error: unknown) => void
) {
  const { storage, saved } = memoryAdapter()
  const harness: Partial<Harness> = {}
  function Table() {
    const table = useTable(
      usePliantTable(
        { features, data, columns, ...options },
        { id: tableId, ...config }
      )
    )
    const store = usePliantStore()
    const resolved = useResolved()
    useLayoutEffect(() => {
      Object.assign(harness, { table, store, resolved })
    })
    return (
      <output>
        {table
          .getRowModel()
          .rows.map((row) => row.original.id)
          .join(" ")}
      </output>
    )
  }
  render(
    <PliantRoot surface={surface} storage={storage} onError={onError}>
      <Table />
    </PliantRoot>
  )
  function get<K extends keyof Harness>(key: K): Harness[K] {
    const value = harness[key]
    if (value === undefined) {
      throw new Error(`No ${key} yet`)
    }
    return value
  }
  return {
    saved,
    rows: () => screen.getByRole("status").textContent.split(" "),
    get table() {
      return get("table")
    },
    get store() {
      return get("store")
    },
    get resolved() {
      return get("resolved")
    },
    placement(address: string) {
      return get("resolved").placements.get(address)?.winner?.check.op
    },
    winner(address: string, property: OpPropertyKey) {
      return get("resolved").properties.get(address)?.get(property)?.winner
    },
  }
}

const column = (id: string) => `${tableId}/columns/${id}`

const aiSort = (field: string, dir: "asc" | "desc") => ({
  v: 1,
  id: "01KAB0000000000000000000S1",
  surface,
  layer: "session",
  ops: [{ op: "setSort", target: tableId, sort: [{ field, dir }] }],
  basis: { contract: 1, core: "0.0.0", manifests: {} },
  source: "ai",
  createdBy: "user-1",
  createdAt: "2026-11-19T00:00:00.000Z",
})

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  sortCalls.mockClear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("usePliantTable", () => {
  it("saves a sort click to the personal layer and sorts the rows", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("value")?.toggleSorting(true)
    })
    const winner = t.winner(tableId, "sort")
    expect(winner?.overlay.layer).toBe("personal")
    expect(winner?.check.op).toEqual({
      op: "setSort",
      target: tableId,
      sort: [{ field: "value", dir: "desc" }],
    })
    expect(t.table.state.sorting).toEqual([{ id: "value", desc: true }])
    const values = t.table
      .getPrePaginatedRowModel()
      .rows.map((row) => row.original.value)
    expect(values).toEqual(values.toSorted((a, b) => b - a))
  })

  it("hides a column with one op", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("status")?.toggleVisibility(false)
    })
    expect(t.winner(column("status"), "visible")?.check.op.op).toBe("hide")
    expect(t.table.getVisibleLeafColumns().map(({ id }) => id)).toEqual([
      "id",
      "customer",
      "value",
    ])
  })

  it("saves a column resize as one version", () => {
    vi.useFakeTimers()
    const t = setup()
    for (const width of [160, 180, 220]) {
      act(() => {
        t.table.setColumnSizing((sizing) => ({ ...sizing, value: width }))
      })
      act(() => {
        vi.advanceTimersByTime(100)
      })
    }
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(t.saved).toHaveLength(1)
    expect(t.saved[0]?.ops).toEqual([
      { op: "setColumnWidth", target: column("value"), width: 220 },
    ])
    expect(t.table.getColumn("value")?.getSize()).toBe(220)
  })

  it("reorders columns with the fewest moves", () => {
    const t = setup()
    act(() => {
      t.table.setColumnOrder(["value", "id", "customer", "status"])
    })
    expect(t.placement(column("value"))).toEqual({
      op: "move",
      target: column("value"),
      to: { before: "id" },
    })
    expect(t.placement(column("id"))).toBeUndefined()
    expect(t.table.getAllLeafColumns().map(({ id }) => id)).toEqual([
      "value",
      "id",
      "customer",
      "status",
    ])
  })

  it("pins a column", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("status")?.pin("start")
    })
    expect(t.table.state.columnPinning).toEqual({ start: ["status"], end: [] })
  })

  it("filters with Pliant's filter functions, in the session layer", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("status")?.setFilterValue({ operator: "isNull" })
    })
    const winner = t.winner(tableId, "filter.status")
    expect(winner?.overlay.layer).toBe("session")
    expect(t.rows()).toEqual(
      data.filter((order) => order.status === null).map(({ id }) => id)
    )

    act(() => {
      t.table
        .getColumn("status")
        ?.setFilterValue({ operator: "neq", value: "paid" })
    })
    expect(t.rows()).toEqual(
      data
        .filter((order) => order.status !== null && order.status !== "paid")
        .map(({ id }) => id)
    )
  })

  it("maps a raw filter value and shows it back unchanged", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("id")?.setFilterValue("O0")
    })
    expect(t.winner(tableId, "filter.id")?.check.op).toEqual({
      op: "setFilter",
      target: tableId,
      filter: { field: "id", operator: "contains", value: "O0" },
    })
    expect(t.table.getColumn("id")?.getFilterValue()).toBe("O0")
    expect(t.rows()).toHaveLength(9)
  })

  it("passes custom filter values to a column's own filter function", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("customer")?.setFilterValue(["Acme"])
    })
    expect(t.winner(tableId, "filter.customer")?.check.op).toEqual({
      op: "setFilter",
      target: tableId,
      filter: { field: "customer", operator: "custom", value: ["Acme"] },
    })
    expect(t.table.getColumn("customer")?.getFilterValue()).toEqual(["Acme"])
    expect(new Set(t.rows())).toEqual(
      new Set(
        data.filter((order) => order.customer === "Acme").map(({ id }) => id)
      )
    )
  })

  it("keeps a filter value it can't save in the table", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("customer")?.setFilterValue("Acme")
    })
    expect(t.winner(tableId, "filter.customer")).toBeUndefined()
    expect(t.table.getColumn("customer")?.getFilterValue()).toBe("Acme")
  })

  it("saves filters to the personal layer with persistFilters", () => {
    const t = setup({}, { persistFilters: true })
    act(() => {
      t.table.getColumn("value")?.setFilterValue({
        operator: "between",
        value: [10, 20],
      })
    })
    expect(t.winner(tableId, "filter.value")?.overlay.layer).toBe("personal")
  })

  it("saves pagination to the session layer", () => {
    const t = setup()
    act(() => {
      t.table.setPageIndex(1)
    })
    const winner = t.winner(tableId, "page")
    expect(winner?.overlay.layer).toBe("session")
    expect(winner?.check.op).toEqual({
      op: "setPage",
      target: tableId,
      index: 1,
    })
    expect(t.table.state.pagination.pageIndex).toBe(1)
  })

  it("resets the page after a sort", async () => {
    const t = setup()
    await act(async () => {
      t.table.setPageIndex(2)
      await Promise.resolve()
    })
    await act(async () => {
      t.table.getColumn("value")?.toggleSorting(false)
      await Promise.resolve()
    })
    expect(t.table.state.pagination.pageIndex).toBe(0)
    expect(t.winner(tableId, "page")?.check.op).toEqual({
      op: "setPage",
      target: tableId,
      index: 0,
    })
  })

  it("starts from initialState, and clears it with ops", () => {
    const t = setup({
      initialState: {
        sorting: [{ id: "value", desc: true }],
        columnVisibility: { status: false },
      },
    })
    expect(t.table.state.sorting).toEqual([{ id: "value", desc: true }])
    expect(t.table.getColumn("status")?.getIsVisible()).toBe(false)
    act(() => {
      t.table.resetSorting(true)
      t.table.getColumn("status")?.toggleVisibility(true)
    })
    expect(t.winner(tableId, "sort")?.check.op).toEqual({
      op: "setSort",
      target: tableId,
      sort: [],
    })
    expect(t.winner(column("status"), "visible")?.check.op.op).toBe("show")
    expect(t.rows()).toEqual(data.map(({ id }) => id))
  })

  it("shows an AI preview of a table op", () => {
    const t = setup()
    const op: Op = {
      op: "setSort",
      target: tableId,
      sort: [{ field: "value", dir: "asc" }],
    }
    act(() => {
      t.store.preview({
        v: 1,
        id: "01KAB0000000000000000000S1",
        surface,
        layer: "session",
        ops: [op],
        basis: { contract: 1, core: "0.0.0", manifests: {} },
        source: "ai",
        createdBy: "user-1",
        createdAt: "2026-11-19T00:00:00.000Z",
      })
    })
    expect(t.table.state.sorting).toEqual([{ id: "value", desc: false }])
    act(() => {
      t.store.discard()
    })
    expect(t.table.state.sorting).toEqual([])
  })

  it("keeps state and row models when something else changes", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("value")?.toggleSorting(false)
    })
    t.table.getRowModel()
    const sorting = t.table.atoms.sorting.get()
    const filters = t.table.atoms.columnFilters.get()
    const calls = sortCalls.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    act(() => {
      expect(
        t.store.applyOps("personal", [
          { op: "setColumnWidth", target: "other-table/columns/a", width: 90 },
        ]).success
      ).toBe(true)
    })
    t.table.getRowModel()
    expect(t.table.atoms.sorting.get()).toBe(sorting)
    expect(t.table.atoms.columnFilters.get()).toBe(filters)
    expect(sortCalls).toHaveBeenCalledTimes(calls)
  })

  it("settles when the columns are a new array every render", () => {
    const renders = vi.fn()
    function Table() {
      renders()
      const table = useTable(
        usePliantTable(
          { features, data, columns: [...columns] },
          { id: tableId }
        )
      )
      return <output>{table.getRowModel().rows.length}</output>
    }
    render(
      <PliantRoot surface={surface} storage={memoryAdapter().storage}>
        <Table />
      </PliantRoot>
    )
    expect(screen.getByRole("status").textContent).toBe("25")
    expect(renders.mock.calls.length).toBeLessThan(10)
  })

  it("registers the table and its columns as mounted", async () => {
    const t = setup()
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      t.store.applyOps("personal", [
        { op: "move", target: column("status"), to: { index: 0 } },
      ])
    })
    expect(t.table.getAllLeafColumns()[0]?.id).toBe("status")
  })

  it("adds the features its ops need", () => {
    const minimal = tableFeatures({ rowSortingFeature })
    let pinning: unknown
    function Table() {
      const table = useTable(
        usePliantTable(
          { features: minimal, data, columns: [] },
          { id: tableId }
        )
      )
      useLayoutEffect(() => {
        pinning = Reflect.get(table.state, "columnPinning")
      })
      return null
    }
    render(
      <PliantRoot surface={surface} storage={memoryAdapter().storage}>
        <Table />
      </PliantRoot>
    )
    expect(pinning).toEqual({ start: [], end: [] })
  })
})

describe("usePliantTable edge cases", () => {
  it("maps range inputs as TanStack's inNumberRange reads them", () => {
    const t = setup()
    act(() => {
      t.table.getColumn("value")?.setFilterValue([undefined, 20])
    })
    expect(t.winner(tableId, "filter.value")?.check.op).toEqual({
      op: "setFilter",
      target: tableId,
      filter: { field: "value", operator: "lte", value: 20 },
    })
    expect(t.table.getColumn("value")?.getFilterValue()).toEqual([
      undefined,
      20,
    ])
    expect(t.rows()).toEqual(
      data.filter((order) => order.value <= 20).map(({ id }) => id)
    )
    act(() => {
      t.table.getColumn("value")?.setFilterValue(["10", "20"])
    })
    expect(t.winner(tableId, "filter.value")?.check.op).toEqual({
      op: "setFilter",
      target: tableId,
      filter: { field: "value", operator: "between", value: [10, 20] },
    })
    expect(t.rows()).toEqual(
      data
        .filter((order) => order.value >= 10 && order.value <= 20)
        .map(({ id }) => id)
    )
    act(() => {
      t.table.getColumn("value")?.setFilterValue([undefined, ""])
    })
    expect(t.table.getColumn("value")?.getFilterValue()).toBeUndefined()
    expect(t.winner(tableId, "filter.value")?.check.op).toEqual({
      op: "clearFilter",
      target: tableId,
      field: "value",
    })
  })

  it("sorts text case-insensitively, without warnings", () => {
    const warn = vi.spyOn(console, "warn")
    const t = setup({
      data: [
        { id: "a", customer: "beta", status: null, value: 1 },
        { id: "b", customer: "Alpha", status: null, value: 2 },
        { id: "c", customer: "alpha2", status: null, value: 3 },
      ],
    })
    act(() => {
      t.table.getColumn("status")?.toggleSorting(false)
      t.table.getColumn("customer")?.toggleSorting(false)
    })
    expect(t.rows()).toEqual(["b", "c", "a"])
    expect(warn).not.toHaveBeenCalled()
  })

  it("keeps the state of a column whose id ops can't name in the table", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({
      columns: helper.columns([
        ...columns,
        helper.accessor((order) => order.value * 2, { id: "2x value" }),
      ]),
    })
    act(() => {
      t.table.getColumn("2x value")?.toggleVisibility(false)
    })
    act(() => {
      t.table.getColumn("2x value")?.setFilterValue("4")
    })
    act(() => {
      t.table.getColumn("2x value")?.toggleSorting(true)
    })
    expect(t.table.getColumn("2x value")?.getIsVisible()).toBe(false)
    expect(t.table.getColumn("2x value")?.getFilterValue()).toBe("4")
    expect(t.table.state.sorting).toEqual([{ id: "2x value", desc: true }])
    expect(t.resolved.properties.size).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('"2x value"')
  })

  it("reports a filter a column's own filter function can't read", async () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({}, {}, onError)
    await act(async () => {
      await Promise.resolve()
    })
    act(() => {
      t.store.applyOps("session", [
        {
          op: "setFilter",
          target: tableId,
          filter: { field: "customer", operator: "eq", value: "Acme" },
        },
      ])
    })
    expect(t.table.getColumn("customer")?.getFilterValue()).toBeUndefined()
    expect(t.rows()).toHaveLength(data.length)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      'the filter on column "customer" of orders-table'
    )
  })

  it("shows a click above an AI preview of the same property", () => {
    const t = setup()
    act(() => {
      t.store.preview(aiSort("value", "desc"))
    })
    act(() => {
      t.table.getColumn("customer")?.toggleSorting(false)
    })
    expect(t.winner(tableId, "sort")?.overlay.layer).toBe("session")
    expect(t.winner(tableId, "sort")?.overlay.source).toBe("manual")
    expect(t.table.state.sorting).toEqual([{ id: "customer", desc: false }])
  })

  it("keeps ready out of the table's options", () => {
    const t = setup()
    expect(Object.keys(t.table.options)).not.toContain("ready")
  })
})

describe("usePliantTable with state rebuilt every render", () => {
  it("keeps a page set from elsewhere", () => {
    const harness: { store?: PliantStore; page?: number } = {}
    function Table() {
      const [pageIndex, setPageIndex] = useState(0)
      const [pageSize, setPageSize] = useState(10)
      const table = useTable(
        usePliantTable(
          {
            features,
            data,
            columns,
            state: { pagination: { pageIndex, pageSize } },
            onPaginationChange: (updater) => {
              const next = functionalUpdate(updater, { pageIndex, pageSize })
              setPageIndex(next.pageIndex)
              setPageSize(next.pageSize)
            },
          },
          { id: tableId }
        )
      )
      const store = usePliantStore()
      useLayoutEffect(() => {
        Object.assign(harness, {
          store,
          page: table.state.pagination.pageIndex,
        })
      })
      return <output>{pageIndex}</output>
    }
    render(
      <PliantRoot surface={surface} storage={memoryAdapter().storage}>
        <Table />
      </PliantRoot>
    )
    act(() => {
      harness.store?.applyOps("session", [
        { op: "setPage", target: tableId, index: 2 },
      ])
    })
    expect(harness.page).toBe(2)
    expect(screen.getByRole("status").textContent).toBe("2")
  })

  it("keeps an AI preview's sort", () => {
    vi.useFakeTimers()
    const { storage, saved } = memoryAdapter()
    const harness: { store?: PliantStore; sorting?: SortingState } = {}
    function Table() {
      const [sorting, setSorting] = useState<SortingState>()
      const table = useTable(
        usePliantTable(
          {
            features,
            data,
            columns,
            state: { sorting: sorting ?? [] },
            onSortingChange: (updater) => {
              setSorting(functionalUpdate(updater, sorting ?? []))
            },
          },
          { id: tableId }
        )
      )
      const store = usePliantStore()
      useLayoutEffect(() => {
        Object.assign(harness, { store, sorting: table.state.sorting })
      })
      return null
    }
    render(
      <PliantRoot surface={surface} storage={storage}>
        <Table />
      </PliantRoot>
    )
    act(() => {
      harness.store?.preview(aiSort("value", "desc"))
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(harness.sorting).toEqual([{ id: "value", desc: true }])
    expect(saved).toEqual([])
  })
})

describe("usePliantTable with developer-owned state", () => {
  function setupOwned() {
    const onSortingChange = vi.fn()
    const harness: {
      table?: ReturnType<typeof useTable<Features, Order>>
      sorting?: SortingState
      setSorting?: (sorting: SortingState) => void
      resolved?: ResolvedLayers
      store?: PliantStore
    } = {}
    function Table() {
      const [sorting, setSorting] = useState<SortingState>([
        { id: "id", desc: true },
      ])
      const table = useTable(
        usePliantTable(
          {
            features,
            data,
            columns,
            state: { sorting },
            onSortingChange: (updater) => {
              onSortingChange(updater)
              setSorting(updater)
            },
          },
          { id: tableId }
        )
      )
      const resolved = useResolved()
      const store = usePliantStore()
      useLayoutEffect(() => {
        Object.assign(harness, { table, sorting, setSorting, resolved, store })
      }, [table, sorting, resolved, store])
      return null
    }
    render(
      <PliantRoot surface={surface} storage={memoryAdapter().storage}>
        <Table />
      </PliantRoot>
    )
    return { harness, onSortingChange }
  }

  const sortOf = (resolved: ResolvedLayers | undefined) =>
    resolved?.properties.get(tableId)?.get("sort")?.winner.check.op

  it("uses their state as the base and calls their callback", () => {
    const { harness, onSortingChange } = setupOwned()
    expect(harness.table?.state.sorting).toEqual([{ id: "id", desc: true }])
    act(() => {
      harness.table?.getColumn("value")?.toggleSorting(false)
    })
    expect(sortOf(harness.resolved)).toEqual({
      op: "setSort",
      target: tableId,
      sort: [{ field: "value", dir: "asc" }],
    })
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "value", desc: false },
    ])
    expect(harness.sorting).toEqual([{ id: "value", desc: false }])
    expect(onSortingChange).toHaveBeenCalledTimes(1)
  })

  it("turns their own changes into ops", () => {
    const { harness } = setupOwned()
    act(() => {
      harness.setSorting?.([])
    })
    expect(sortOf(harness.resolved)).toEqual({
      op: "setSort",
      target: tableId,
      sort: [],
    })
    expect(harness.table?.state.sorting).toEqual([])
  })

  it("keeps their state in sync with ops from elsewhere", () => {
    const { harness, onSortingChange } = setupOwned()
    expect(onSortingChange).not.toHaveBeenCalled()
    act(() => {
      harness.store?.applyOps("personal", [
        {
          op: "setSort",
          target: tableId,
          sort: [{ field: "customer", dir: "desc" }],
        },
      ])
    })
    expect(harness.table?.state.sorting).toEqual([
      { id: "customer", desc: true },
    ])
    expect(harness.sorting).toEqual([{ id: "customer", desc: true }])
    expect(onSortingChange).toHaveBeenCalledTimes(1)
    expect(sortOf(harness.resolved)).toEqual({
      op: "setSort",
      target: tableId,
      sort: [{ field: "customer", dir: "desc" }],
    })
  })
})
