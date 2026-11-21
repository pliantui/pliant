import { useLayoutEffect } from "react"
import {
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  rowAggregationFeature,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Row,
} from "@tanstack/react-table"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Expression, Op } from "@pliantui/contract"

import { memoryStorage } from "../test/storage"
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
  value: number
}

const data: Order[] = [
  { id: "o01", customer: "Acme", status: "paid", value: 40 },
  { id: "o02", customer: "Globex", status: "open", value: 15 },
  { id: "o03", customer: "Acme", status: "open", value: 25 },
  { id: "o04", customer: "Initech", status: "paid", value: 70 },
  { id: "o05", customer: "Globex", status: "paid", value: 5 },
  { id: "o06", customer: "Acme", status: "paid", value: 30 },
  { id: "o07", customer: "Initech", status: "open", value: 60 },
]

const dataset: PliantTableDataset = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    status: { type: "string" },
    value: { type: "number" },
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
  rowSortingFeature,
})

type Features = typeof features

const helper = createColumnHelper<Features, Order>()

const columns = helper.columns([
  helper.accessor("id", {}),
  helper.accessor("customer", {}),
  helper.accessor("status", {}),
  helper.accessor("value", {}),
])

function setup(
  config: { dataset?: PliantTableDataset | undefined } = { dataset },
  onError?: (error: unknown) => void
) {
  const { storage } = memoryStorage()
  let table: ReturnType<typeof useTable<Features, Order>> | undefined
  let store: PliantStore | undefined
  function Table() {
    const current = useTable(
      usePliantTable(
        { features, data, columns },
        { id: tableId, dataset: config.dataset }
      )
    )
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
    apply(...ops: Op[]) {
      act(() => {
        const result = store?.applyOps("personal", ops)
        expect(result?.success).toBe(true)
      })
    },
  }
}

const sum = (rows: readonly Order[]) =>
  rows.reduce((total, order) => total + order.value, 0)

const field = (id: string): Expression => ({ field: id })
const call = (fn: string, ...args: Expression[]): Expression => ({ fn, args })

const aggregate = (id: string, label: string, expr: Expression): Op => ({
  op: "addAggregate",
  target: tableId,
  id,
  label,
  expr,
})

const total = aggregate("total", "Total", call("sum", field("value")))
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

function groups(table: ReturnType<typeof setup>["table"]) {
  return table.getRowModel().rows.filter((row) => row.getIsGrouped())
}

function valueOf(row: Row<Features, Order>, column: string): unknown {
  return row.getValue(column)
}

function groupValue(
  table: ReturnType<typeof setup>["table"],
  group: string,
  column: string
) {
  const row = groups(table).find(({ groupingValue }) => groupingValue === group)
  if (!row) {
    throw new Error(`No group ${group}`)
  }
  return valueOf(row, column)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("usePliantTable grouping", () => {
  it("groups rows by the fields of a setGroupBy op", () => {
    const t = setup()
    t.apply(groupBy("customer"))
    expect(groups(t.table).map((row) => row.groupingValue)).toEqual([
      "Acme",
      "Globex",
      "Initech",
    ])
    expect(groups(t.table).map((row) => row.getLeafRows().length)).toEqual([
      3, 2, 2,
    ])

    t.apply(groupBy())
    expect(groups(t.table)).toEqual([])
    expect(t.table.getRowModel().rows).toHaveLength(data.length)
  })

  it("shows a group's rows when it expands", () => {
    const t = setup()
    t.apply(groupBy("customer"))
    act(() => {
      groups(t.table)[0]?.toggleExpanded(true)
    })
    expect(t.table.getRowModel().rows.map((row) => row.original.id)).toEqual([
      "o01",
      "o01",
      "o03",
      "o06",
      "o02",
      "o04",
    ])
  })
})

describe("usePliantTable features", () => {
  it("adds the features that grouping and aggregates need", () => {
    const bare = tableFeatures({ rowSortingFeature })
    const bareHelper = createColumnHelper<typeof bare, Order>()
    const bareColumns = bareHelper.columns([
      bareHelper.accessor("status", {}),
      bareHelper.accessor("value", {}),
    ])
    const { storage } = memoryStorage()
    let rows: {
      id: string
      call: (name: string, ...args: unknown[]) => unknown
    }[] = []
    let store: PliantStore | undefined
    function Bare() {
      const table = useTable(
        usePliantTable(
          { features: bare, data, columns: bareColumns },
          { id: tableId, dataset }
        )
      )
      const actions = usePliantStore()
      useLayoutEffect(() => {
        store = actions
      })
      rows = table.getRowModel().rows.map((row) => ({
        id: row.id,
        call: (name, ...args) => {
          const method: unknown = Reflect.get(row, name)
          if (typeof method !== "function") {
            throw new TypeError(`No row method ${name}`)
          }
          const result: unknown = Reflect.apply(method, row, args)
          return result
        },
      }))
      return (
        <output>
          {table
            .getRowModel()
            .rows.map((row) => String(row.getValue("total") ?? "-"))
            .join(" ")}
        </output>
      )
    }
    render(
      <PliantRoot surface="/orders" storage={storage}>
        <Bare />
      </PliantRoot>
    )
    act(() => {
      store?.applyOps("personal", [groupBy("status"), total])
    })
    expect(rows.map((row) => row.id)).toEqual(["status:paid", "status:open"])
    const paid = String(sum(data.filter((order) => order.status === "paid")))
    const open = String(sum(data.filter((order) => order.status === "open")))
    expect(screen.getByRole("status").textContent).toBe(`${paid} ${open}`)

    act(() => {
      rows[0]?.call("toggleExpanded", true)
    })
    expect(rows).toHaveLength(1 + 4 + 1)
    expect(screen.getByRole("status").textContent).toBe(
      `${paid} - - - - ${open}`
    )
  })
})

describe("usePliantTable aggregates", () => {
  it("adds a column per addAggregate op that totals each group", () => {
    const t = setup()
    t.apply(total, groupBy("status"))
    const column = t.table.getColumn("total")
    expect(column?.columnDef.header).toBe("Total")
    expect(column?.getCanGroup()).toBe(false)
    expect(t.table.getAllLeafColumns().map(({ id }) => id)).toContain("total")
    expect(groupValue(t.table, "paid", "total")).toBe(
      sum(data.filter((order) => order.status === "paid"))
    )
    expect(groupValue(t.table, "open", "total")).toBe(
      sum(data.filter((order) => order.status === "open"))
    )
  })

  it("leaves other columns without a value on a group's row", () => {
    const t = setup()
    t.apply(total, groupBy("status"))
    const row = groups(t.table)[0]
    expect(row?.getAllCells().map((cell) => cell.getIsAggregated())).toEqual([
      false,
      false,
      false,
      false,
      true,
    ])
  })

  it("computes an expression over the group, such as a share of the total", () => {
    const t = setup()
    t.apply(
      aggregate(
        "average",
        "Average",
        call("div", call("sum", field("value")), call("count"))
      ),
      groupBy("customer")
    )
    expect(groupValue(t.table, "Acme", "average")).toBe((40 + 25 + 30) / 3)
  })

  it("totals the filtered rows for the whole table", () => {
    const t = setup()
    t.apply(total)
    expect(t.table.getColumn("total")?.getAggregationValue()).toBe(sum(data))
    act(() => {
      t.table
        .getColumn("status")
        ?.setFilterValue({ operator: "eq", value: "open" })
    })
    expect(t.table.getColumn("total")?.getAggregationValue()).toBe(
      sum(data.filter((order) => order.status === "open"))
    )
  })

  it("sums only the filtered rows of a group", () => {
    const t = setup()
    t.apply(total, groupBy("customer"))
    act(() => {
      t.table
        .getColumn("status")
        ?.setFilterValue({ operator: "eq", value: "paid" })
    })
    expect(groupValue(t.table, "Acme", "total")).toBe(70)
  })

  it("reads first and last in the order of the table's sort", () => {
    const t = setup()
    t.apply(
      aggregate("first", "First", call("first", field("id"))),
      aggregate("last", "Last", call("last", field("id"))),
      groupBy("customer")
    )
    const ids = () =>
      Object.fromEntries(
        groups(t.table).map((row): [string, unknown[]] => [
          String(row.groupingValue),
          [valueOf(row, "first"), valueOf(row, "last")],
        ])
      )
    expect(ids()).toEqual({
      Acme: ["o01", "o06"],
      Globex: ["o02", "o05"],
      Initech: ["o04", "o07"],
    })

    t.apply(sortBy("value", "asc"))
    expect(ids()).toEqual({
      Acme: ["o03", "o01"],
      Globex: ["o05", "o02"],
      Initech: ["o07", "o04"],
    })

    t.apply(sortBy("value", "desc"))
    expect(ids()).toEqual({
      Acme: ["o01", "o03"],
      Globex: ["o02", "o05"],
      Initech: ["o04", "o07"],
    })
  })

  it("breaks ties by the order of the data", () => {
    const t = setup()
    t.apply(
      aggregate("first", "First", call("first", field("id"))),
      groupBy("customer"),
      sortBy("status", "asc")
    )
    expect(groupValue(t.table, "Acme", "first")).toBe("o03")
    t.apply(sortBy("status", "desc"))
    expect(groupValue(t.table, "Acme", "first")).toBe("o01")
  })

  it("follows the sort in the whole table's first and last too", () => {
    const t = setup()
    t.apply(aggregate("first", "First", call("first", field("id"))))
    expect(t.table.getColumn("first")?.getAggregationValue()).toBe("o01")
    t.apply(sortBy("value", "asc"))
    expect(t.table.getColumn("first")?.getAggregationValue()).toBe("o05")
    t.apply(sortBy("value", "desc"))
    expect(t.table.getColumn("first")?.getAggregationValue()).toBe("o04")
  })

  it("sorts groups by an aggregate", () => {
    const t = setup()
    t.apply(total, groupBy("customer"), sortBy("total", "desc"))
    expect(groups(t.table).map((row) => row.groupingValue)).toEqual([
      "Initech",
      "Acme",
      "Globex",
    ])
  })

  it("lets ops hide and reorder an aggregate like any column", () => {
    const t = setup()
    t.apply(total)
    expect(t.table.getVisibleLeafColumns().map(({ id }) => id)).toEqual([
      "id",
      "customer",
      "status",
      "value",
      "total",
    ])
    t.apply({
      op: "move",
      target: `${tableId}/columns/total`,
      to: { before: "id" },
    })
    expect(t.table.getVisibleLeafColumns()[0]?.id).toBe("total")
    t.apply({ op: "hide", target: `${tableId}/columns/total` })
    expect(t.table.getVisibleLeafColumns().map(({ id }) => id)).toEqual([
      "id",
      "customer",
      "status",
      "value",
    ])
  })

  it("drops the column when the aggregate is removed", () => {
    const onError = vi.fn()
    const t = setup({ dataset }, onError)
    t.apply(total)
    t.apply({ op: "removeUserItem", target: tableId, id: "total" })
    expect(t.table.getColumn("total")).toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })

  it("reports an aggregate that reads an unknown field and leaves it out", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(aggregate("bad", "Bad", call("sum", field("missing"))))
    expect(t.table.getColumn("bad")).toBeUndefined()
    expect(onError).toHaveBeenCalledOnce()
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no aggregate bad"
    )
    t.apply(total)
    expect(t.table.getColumn("total")).toBeDefined()
  })

  it("keeps a column that has the aggregate's id, and reports it", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(aggregate("value", "Sum", call("sum", field("value"))))
    expect(t.table.getColumn("value")?.columnDef.header).not.toBe("Sum")
    expect(t.table.getAllLeafColumns()).toHaveLength(4)
    expect(String(onError.mock.calls[0]?.[0])).toContain("a column has its id")
  })

  it("shows no aggregate without a dataset, and says so", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset: undefined }, onError)
    t.apply(total)
    expect(t.table.getColumn("total")).toBeUndefined()
    expect(String(onError.mock.calls[0]?.[0])).toContain("dataset")
  })
})
