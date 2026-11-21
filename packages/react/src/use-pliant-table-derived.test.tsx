import { useLayoutEffect } from "react"
import {
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Row,
} from "@tanstack/react-table"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Expression, Format, Op } from "@pliantui/contract"

import { memoryStorage } from "../test/storage"
import { useLayerStore } from "./pliant-context"
import { PliantRoot } from "./pliant-root"
import type { PliantStore } from "./pliant-store"
import type { PliantTableDataset } from "./table-aggregates"
import { usePliantStore } from "./use-pliant-store"
import { usePliantTable } from "./use-pliant-table"

const tableId = "orders-table"

interface Order {
  id: string
  customer: string
  status: string
  value?: number
}

const data: Order[] = [
  { id: "o01", customer: "Acme", status: "paid", value: 40 },
  { id: "o02", customer: "Globex", status: "open", value: 10 },
  { id: "o03", customer: "Acme", status: "open", value: 30 },
  { id: "o04", customer: "Initech", status: "paid", value: 20 },
]

const dataset: PliantTableDataset = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    status: { type: "string" },
    value: { type: "currency", currency: "INR" },
  },
  timeZone: "UTC",
}

const features = tableFeatures({
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

type Features = typeof features

const helper = createColumnHelper<Features, Order>()

const columns = helper.columns([
  helper.accessor("id", {}),
  helper.accessor("customer", {}),
  helper.accessor("status", {}),
  helper.accessor("value", {}),
])

interface SetupConfig {
  dataset?: PliantTableDataset | undefined
  rows?: Order[]
  getRowId?: (row: Order) => string
}

function setup(
  config: SetupConfig = { dataset },
  onError?: (error: unknown) => void
) {
  const { storage } = memoryStorage()
  let table: ReturnType<typeof useTable<Features, Order>> | undefined
  let store: PliantStore | undefined
  const mounted = new Map<string, number>()
  let spied = false
  function Table() {
    const layers = useLayerStore("test")
    if (!spied) {
      spied = true
      const register = layers.registerNodes
      vi.spyOn(layers, "registerNodes").mockImplementation((ids) => {
        ids.forEach((id) => mounted.set(id, (mounted.get(id) ?? 0) + 1))
        const unregister = register(ids)
        return () => {
          ids.forEach((id) => mounted.set(id, (mounted.get(id) ?? 1) - 1))
          unregister()
        }
      })
    }
    const current = useTable(
      usePliantTable(
        {
          features,
          data: config.rows ?? data,
          columns,
          ...(config.getRowId && { getRowId: config.getRowId }),
        },
        { id: tableId, dataset: config.dataset }
      )
    )
    // A table that is shown reads its rows as it renders.
    current.getRowModel()
    const actions = usePliantStore()
    useLayoutEffect(() => {
      table = current
      store = actions
    })
    return null
  }
  render(
    <PliantRoot surface="/orders" storage={storage} onError={onError}>
      <Table />
    </PliantRoot>
  )
  return {
    get table() {
      if (!table) throw new Error("No table yet")
      return table
    },
    mounted: () =>
      [...mounted].flatMap(([id, count]) => (count > 0 ? [id] : [])),
    apply(...ops: Op[]) {
      act(() => {
        const result = store?.applyOps("personal", ops)
        expect(result?.success).toBe(true)
      })
    },
  }
}

type Setup = ReturnType<typeof setup>

const field = (id: string): Expression => ({ field: id })
const value = (literal: number): Expression => ({ value: literal })
const call = (fn: string, ...args: Expression[]): Expression => ({ fn, args })

const derived = (
  id: string,
  label: string,
  expr: Expression,
  format?: Format
): Op => ({
  op: "addDerived",
  target: tableId,
  id,
  label,
  expr,
  ...(format && { format }),
})

const aggregate = (id: string, label: string, expr: Expression): Op => ({
  op: "addAggregate",
  target: tableId,
  id,
  label,
  expr,
})

const double = derived(
  "double",
  "Double",
  call("mul", field("value"), value(2))
)
const share = derived("share", "Share", call("share", field("value")))
const groupBy = (...fields: string[]): Op => ({
  op: "setGroupBy",
  target: tableId,
  fields,
})
const sortBy = (field: string, dir: "asc" | "desc"): Op => ({
  op: "setSort",
  target: tableId,
  sort: [{ field, dir }],
})

function rows(t: Setup) {
  return t.table.getRowModel().rows
}

function valuesOf(t: Setup, column: string) {
  return rows(t).map((row: Row<Features, Order>) => {
    const cell: unknown = row.getValue(column)
    return cell
  })
}

function idsOf(t: Setup) {
  return rows(t).map((row) => row.original.id)
}

function setFilter(t: Setup, column: string, filter: unknown) {
  act(() => {
    t.table.getColumn(column)?.setFilterValue(filter)
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("usePliantTable derived columns", () => {
  it("adds a column per addDerived op that reads each row's value", () => {
    const t = setup()
    t.apply(double)
    const column = t.table.getColumn("double")
    expect(column?.columnDef.header).toBe("Double")
    expect(t.table.getAllLeafColumns().map(({ id }) => id)).toContain("double")
    expect(valuesOf(t, "double")).toEqual([80, 20, 60, 40])
  })

  it("gives the column's type, unit and format to meta.pliant", () => {
    const t = setup()
    const format: Format = { type: "currency", currency: "INR", decimals: 0 }
    t.apply(
      derived(
        "double",
        "Double",
        call("mul", field("value"), value(2)),
        format
      ),
      derived("share", "Share", call("share", field("value")))
    )
    expect(t.table.getColumn("double")?.columnDef.meta).toEqual({
      label: "Double",
      pliant: { type: "number", unit: "INR", format, derived: true },
    })
    expect(t.table.getColumn("share")?.columnDef.meta).toEqual({
      label: "Share",
      pliant: { type: "number", unit: "percent", derived: true },
    })
  })

  it("can be sorted, with missing values last in either direction", () => {
    const t = setup({
      dataset,
      rows: [
        { id: "o01", customer: "Acme", status: "paid", value: 40 },
        { id: "o02", customer: "Acme", status: "paid" },
        { id: "o03", customer: "Acme", status: "paid", value: 10 },
        { id: "o04", customer: "Acme", status: "paid", value: -5 },
      ],
    })
    t.apply(double, sortBy("double", "asc"))
    expect(idsOf(t)).toEqual(["o04", "o03", "o01", "o02"])
    t.apply(sortBy("double", "desc"))
    expect(idsOf(t)).toEqual(["o01", "o03", "o04", "o02"])
  })

  it("can be filtered", () => {
    const t = setup()
    t.apply(double)
    expect(t.table.getColumn("double")?.getCanFilter()).toBe(true)
    setFilter(t, "double", { operator: "gte", value: 60 })
    expect(idsOf(t)).toEqual(["o01", "o03"])
  })

  it("can be grouped by, and has no value on a group's row", () => {
    const t = setup()
    t.apply(
      derived(
        "band",
        "Band",
        call(
          "if",
          call("gt", field("value"), value(25)),
          { value: "high" },
          { value: "low" }
        )
      ),
      groupBy("band")
    )
    const groups = rows(t).filter((row) => row.getIsGrouped())
    expect(groups.map((row) => row.groupingValue)).toEqual(["high", "low"])
    act(() => {
      groups[0]?.toggleExpanded(true)
    })
    const group = rows(t)[0]
    expect(group?.getValue("band")).toBe("high")
    expect(group?.getAllCells().map((cell) => cell.getIsAggregated())).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
  })

  it("lets ops hide and reorder it like any column", () => {
    const t = setup()
    t.apply(double)
    t.apply({
      op: "move",
      target: `${tableId}/columns/double`,
      to: { before: "id" },
    })
    expect(t.table.getVisibleLeafColumns()[0]?.id).toBe("double")
    t.apply({ op: "hide", target: `${tableId}/columns/double` })
    expect(t.table.getVisibleLeafColumns().map(({ id }) => id)).toEqual([
      "id",
      "customer",
      "status",
      "value",
    ])
  })

  it("computes again when an op redefines it", () => {
    const t = setup()
    t.apply(double)
    expect(valuesOf(t, "double")).toEqual([80, 20, 60, 40])
    t.apply(derived("double", "Double", call("mul", field("value"), value(3))))
    expect(valuesOf(t, "double")).toEqual([120, 30, 90, 60])
  })

  it("sorts again when a sorted column is redefined", () => {
    const t = setup()
    t.apply(double, sortBy("double", "asc"))
    expect(idsOf(t)).toEqual(["o02", "o04", "o03", "o01"])
    t.apply(derived("double", "Double", call("mul", field("value"), value(-1))))
    expect(valuesOf(t, "double")).toEqual([-40, -30, -20, -10])
    expect(idsOf(t)).toEqual(["o01", "o03", "o04", "o02"])
  })

  it("filters again when a filtered column is redefined", () => {
    const t = setup()
    t.apply(double)
    setFilter(t, "double", { operator: "gte", value: 60 })
    expect(idsOf(t)).toEqual(["o01", "o03"])
    t.apply(derived("double", "Double", call("mul", field("value"), value(1))))
    expect(idsOf(t)).toEqual([])
  })

  it("accumulates in the new order when the sort column is redefined", () => {
    const t = setup()
    t.apply(
      double,
      derived("running", "Running", call("runningSum", field("value"))),
      sortBy("double", "asc")
    )
    expect(valuesOf(t, "running")).toEqual([10, 30, 60, 100])
    t.apply(derived("double", "Double", call("mul", field("value"), value(-1))))
    expect(
      rows(t).map((row) => [row.original.id, row.getValue("running")])
    ).toEqual([
      ["o01", 40],
      ["o03", 70],
      ["o04", 90],
      ["o02", 100],
    ])
  })

  it("keeps the page when it changes", async () => {
    const t = setup()
    t.apply(share)
    expect(rows(t)).toHaveLength(4)
    await act(() => Promise.resolve())
    act(() => {
      t.table.setPageSize(2)
    })
    act(() => {
      t.table.setPageIndex(1)
    })
    expect(idsOf(t)).toEqual(["o03", "o04"])
    await act(() => Promise.resolve())
    expect(idsOf(t)).toEqual(["o03", "o04"])
    expect(t.table.state.pagination.pageIndex).toBe(1)
  })

  it("registers its column as mounted until the op is removed", () => {
    const t = setup()
    t.apply(double)
    expect(t.mounted()).toContain(`${tableId}/columns/double`)
    t.apply({ op: "removeUserItem", target: tableId, id: "double" })
    expect(t.mounted()).not.toContain(`${tableId}/columns/double`)
  })

  it("drops the column when the op is removed", () => {
    const onError = vi.fn()
    const t = setup({ dataset }, onError)
    t.apply(double)
    t.apply({ op: "removeUserItem", target: tableId, id: "double" })
    expect(t.table.getColumn("double")).toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })

  it("keeps its column when the sort changes", () => {
    const t = setup()
    t.apply(double, share)
    const columns = ["double", "share"].map((id) => t.table.getColumn(id))
    t.apply(sortBy("value", "asc"))
    expect(["double", "share"].map((id) => t.table.getColumn(id))).toEqual(
      columns
    )
  })

  it("reads one derived column from another by ref", () => {
    const t = setup()
    t.apply(
      double,
      derived("quad", "Quad", call("mul", { ref: "double" }, value(2)))
    )
    expect(valuesOf(t, "quad")).toEqual([160, 40, 120, 80])
  })

  it("reads today in the viewer's time zone for a personal column", () => {
    vi.stubEnv("TZ", "Pacific/Kiritimati")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-03-10T23:30:00Z"))
    const t = setup()
    t.apply(derived("today", "Today", call("today")))
    expect(valuesOf(t, "today")[0]).toBe("2026-03-11")
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("can be summed by an aggregate that refers to it", () => {
    const t = setup()
    t.apply(double, aggregate("total", "Total", call("sum", { ref: "double" })))
    expect(t.table.getColumn("total")?.getAggregationValue()).toBe(200)
  })
})

describe("usePliantTable window columns", () => {
  it("gives each row its share of the filtered rows", () => {
    const t = setup()
    t.apply(share)
    expect(valuesOf(t, "share")).toEqual([0.4, 0.1, 0.3, 0.2])
    setFilter(t, "status", { operator: "eq", value: "paid" })
    expect(valuesOf(t, "share")).toEqual([40 / 60, 20 / 60])
  })

  it("computes within each group of a grouped table", () => {
    const t = setup()
    t.apply(share, groupBy("customer"))
    act(() => {
      rows(t).forEach((row) => {
        row.toggleExpanded(true)
      })
    })
    const leaves = rows(t).filter((row) => !row.getIsGrouped())
    expect(
      leaves.map((row) => [row.original.id, row.getValue("share")])
    ).toEqual([
      ["o01", 40 / 70],
      ["o03", 30 / 70],
      ["o02", 1],
      ["o04", 1],
    ])
  })

  it("sorts by a window column, and can't be filtered or grouped by", () => {
    const t = setup()
    t.apply(share, sortBy("share", "desc"))
    expect(idsOf(t)).toEqual(["o01", "o03", "o04", "o02"])
    const column = t.table.getColumn("share")
    expect(column?.getCanFilter()).toBe(false)
    expect(column?.getCanGroup()).toBe(false)
  })

  it("accumulates a running sum in the order of the table's sort", () => {
    const t = setup()
    t.apply(
      derived("running", "Running", call("runningSum", field("value"))),
      sortBy("value", "desc")
    )
    expect(
      rows(t).map((row) => [row.original.id, row.getValue("running")])
    ).toEqual([
      ["o01", 40],
      ["o03", 70],
      ["o04", 90],
      ["o02", 100],
    ])
    t.apply(sortBy("value", "asc"))
    expect(valuesOf(t, "running")).toEqual([10, 30, 60, 100])
  })

  it("orders ties and an unsorted table by the row key", () => {
    const tied: Order[] = [
      { id: "b", customer: "Acme", status: "paid", value: 1 },
      { id: "c", customer: "Acme", status: "open", value: 2 },
      { id: "a", customer: "Acme", status: "open", value: 4 },
      { id: "d", customer: "Acme", status: "paid", value: 8 },
    ]
    const running = derived(
      "running",
      "Running",
      call("runningSum", field("value"))
    )
    const t = setup({ dataset, rows: tied })
    t.apply(running)
    const byId = () =>
      Object.fromEntries(
        rows(t).map((row) => [row.original.id, row.getValue("running")])
      )
    expect(byId()).toEqual({ a: 4, b: 5, c: 7, d: 15 })
    t.apply(sortBy("status", "asc"))
    expect(byId()).toEqual({ a: 4, c: 6, b: 7, d: 15 })
    t.apply(sortBy("status", "desc"))
    expect(byId()).toEqual({ b: 1, d: 9, a: 13, c: 15 })
  })

  it("takes the row key from getRowId when the table has one", () => {
    const keys: Record<string, string> = {
      o01: "3",
      o02: "2",
      o03: "1",
      o04: "0",
    }
    const t = setup({
      dataset,
      getRowId: (row) => keys[row.id] ?? row.id,
    })
    t.apply(derived("running", "Running", call("runningSum", field("value"))))
    expect(valuesOf(t, "running")).toEqual([100, 60, 50, 20])
  })

  it("reads the same display order as first and last", () => {
    const t = setup()
    t.apply(
      derived("running", "Running", call("runningSum", field("value"))),
      aggregate("first", "First", call("first", field("id"))),
      sortBy("value", "desc")
    )
    const [first] = rows(t)
    expect(first?.getValue("running")).toBe(first?.original.value)
    expect(t.table.getColumn("first")?.getAggregationValue()).toBe(
      first?.original.id
    )
  })

  it("leaves a sort by a window column out of the order the window reads", () => {
    const t = setup()
    t.apply(
      derived("running", "Running", call("runningSum", field("value"))),
      share,
      sortBy("share", "asc")
    )
    expect(
      Object.fromEntries(
        rows(t).map((row) => [row.original.id, row.getValue("running")])
      )
    ).toEqual({
      o01: 40,
      o02: 50,
      o03: 80,
      o04: 100,
    })
  })

  it("leaves out a grouping and a filter by a window column, and reports them", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(share)
    t.apply(groupBy("share"), {
      op: "setFilter",
      target: tableId,
      filter: { field: "share", operator: "gte", value: 0.3 },
    })
    expect(t.table.state.grouping).toEqual([])
    expect(t.table.state.columnFilters).toEqual([])
    expect(idsOf(t)).toEqual(["o01", "o02", "o03", "o04"])
    expect(valuesOf(t, "share")).toEqual([0.4, 0.1, 0.3, 0.2])
    expect(onError.mock.calls.map(([error]) => String(error))).toEqual([
      expect.stringContaining("group or filter by share"),
    ])
  })

  it("reports an expression that can't be computed and leaves it out", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(derived("bad", "Bad", call("share", field("missing"))))
    expect(t.table.getColumn("bad")).toBeUndefined()
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no derived column bad"
    )
  })
})

describe("usePliantTable derived columns that can't be added", () => {
  it("keeps a column that has the id, and reports it", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(derived("value", "Mine", call("abs", field("value"))))
    expect(t.table.getColumn("value")?.columnDef.header).not.toBe("Mine")
    expect(t.table.getAllLeafColumns()).toHaveLength(4)
    expect(String(onError.mock.calls[0]?.[0])).toContain("a column has its id")
  })

  it("keeps a derived column over an aggregate with the same id", () => {
    const onError = vi.fn()
    const t = setup({ dataset }, onError)
    t.apply(double, aggregate("double", "Total", call("sum", field("value"))))
    expect(t.table.getColumn("double")?.columnDef.header).toBe("Double")
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no aggregate double: a column has its id"
    )
  })

  it("shows nothing without a dataset, and says so", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset: undefined }, onError)
    t.apply(double)
    expect(t.table.getColumn("double")).toBeUndefined()
    expect(String(onError.mock.calls[0]?.[0])).toContain("dataset")
  })

  it("doesn't take ops for a column it left out", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, vi.fn())
    t.apply(
      derived("bad", "Bad", call("abs", field("missing"))),
      { op: "hide", target: `${tableId}/columns/bad` },
      { op: "move", target: `${tableId}/columns/bad`, to: { before: "id" } }
    )
    expect(t.table.state.columnOrder).toEqual([
      "id",
      "customer",
      "status",
      "value",
    ])
    expect(t.table.state.columnVisibility).toEqual({})
  })
})
