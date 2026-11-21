import { useLayoutEffect } from "react"
import {
  columnFilteringFeature,
  columnGroupingFeature,
  createColumnHelper,
  rowExpandingFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Expression, Op } from "@pliantui/contract"

import { memoryStorage } from "../test/storage"
import { PliantRoot } from "./pliant-root"
import type { PliantTableDataset } from "./table-aggregates"
import { getPliantHighlights } from "./table-highlights"
import { usePliantStore } from "./use-pliant-store"
import { usePliantTable } from "./use-pliant-table"

const tableId = "orders-table"

interface Order {
  id: string
  customer: string
  value: number
}

const data: Order[] = [
  { id: "o01", customer: "Acme", value: 40 },
  { id: "o02", customer: "Globex", value: 10 },
  { id: "o03", customer: "Acme", value: 30 },
  { id: "o04", customer: "Initech", value: 20 },
]

const dataset: PliantTableDataset = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    value: { type: "currency", currency: "INR" },
  },
  timeZone: "UTC",
}

const features = tableFeatures({
  columnFilteringFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  rowSortingFeature,
})

type Features = typeof features

const helper = createColumnHelper<Features, Order>()

const columns = helper.columns([
  helper.accessor("id", {}),
  helper.accessor("customer", {}),
  helper.accessor("value", {}),
])

function setup(
  config: { dataset?: PliantTableDataset | undefined } = { dataset },
  onError?: (error: unknown) => void
) {
  const { storage } = memoryStorage()
  let table: ReturnType<typeof useTable<Features, Order>> | undefined
  let store: ReturnType<typeof usePliantStore> | undefined
  function Table() {
    const current = useTable(
      usePliantTable(
        { features, data, columns },
        { id: tableId, dataset: config.dataset }
      )
    )
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
const value = (literal: number | string): Expression => ({ value: literal })
const call = (fn: string, ...args: Expression[]): Expression => ({ fn, args })

const highlight = (
  id: string,
  when: Expression,
  tone: "emphasis" | "success" | "warning" | "danger" = "warning"
): Op => ({ op: "addHighlight", target: tableId, id, when, tone })

const over = (threshold: number) => call("gt", field("value"), value(threshold))
const largest = call("eq", call("rank", field("value")), value(1))

// Each shown row's id with the ids and tones of its highlights.
function highlightsOf(t: Setup) {
  return t.table
    .getRowModel()
    .rows.map((row) => [
      row.groupingColumnId === undefined ? row.original.id : row.id,
      getPliantHighlights(row).map(({ id, tone }) => `${id}:${tone}`),
    ])
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("usePliantTable highlights", () => {
  it("gives a row each highlight whose condition is true for it", () => {
    const t = setup()
    expect(highlightsOf(t)).toEqual([
      ["o01", []],
      ["o02", []],
      ["o03", []],
      ["o04", []],
    ])
    t.apply(highlight("large", over(25), "emphasis"))
    expect(highlightsOf(t)).toEqual([
      ["o01", ["large:emphasis"]],
      ["o02", []],
      ["o03", ["large:emphasis"]],
      ["o04", []],
    ])
  })

  it("gives no row a highlight whose condition is null", () => {
    const t = setup()
    t.apply(highlight("unknown", call("gt", field("value"), { value: null })))
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toEqual([])
  })

  it("lists a row's highlights in the order their ops applied", () => {
    const t = setup()
    t.apply(highlight("acme", call("eq", field("customer"), value("Acme"))))
    t.apply(highlight("large", over(35), "danger"))
    expect(highlightsOf(t)[0]).toEqual([
      "o01",
      ["acme:warning", "large:danger"],
    ])
  })

  it("computes again when an op redefines a highlight", () => {
    const t = setup()
    t.apply(highlight("large", over(35)))
    t.apply(highlight("large", over(15), "success"))
    expect(highlightsOf(t)).toEqual([
      ["o01", ["large:success"]],
      ["o02", []],
      ["o03", ["large:success"]],
      ["o04", ["large:success"]],
    ])
  })

  it("drops a highlight when removeUserItem removes it", () => {
    const t = setup()
    t.apply(highlight("large", over(25)))
    t.apply({ op: "removeUserItem", target: tableId, id: "large" })
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toEqual([])
  })

  it("reads a derived column by ref", () => {
    const t = setup()
    t.apply(
      {
        op: "addDerived",
        target: tableId,
        id: "double",
        label: "Double",
        expr: call("mul", field("value"), value(2)),
      },
      highlight("large", call("gt", { ref: "double" }, value(70)))
    )
    expect(highlightsOf(t)[0]).toEqual(["o01", ["large:warning"]])
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toHaveLength(1)
  })

  it("has its own ids, apart from the columns'", () => {
    const onError = vi.fn()
    const t = setup({ dataset }, onError)
    t.apply(highlight("value", over(35)))
    expect(highlightsOf(t)[0]).toEqual(["o01", ["value:warning"]])
    expect(onError).not.toHaveBeenCalled()
  })
})

describe("usePliantTable highlights with window functions", () => {
  it("computes over the rows that pass the filters", () => {
    const t = setup()
    t.apply(highlight("top", largest))
    expect(highlightsOf(t)[0]).toEqual(["o01", ["top:warning"]])
    act(() => {
      t.table.getColumn("customer")?.setFilterValue("Globex")
    })
    expect(highlightsOf(t)).toEqual([["o02", ["top:warning"]]])
  })

  it("computes within each group, and gives a group's row none", () => {
    const t = setup()
    t.apply(highlight("top", largest), highlight("large", over(35)), {
      op: "setGroupBy",
      target: tableId,
      fields: ["customer"],
    })
    act(() => {
      t.table.getRowModel().rows.forEach((row) => {
        row.toggleExpanded(true)
      })
    })
    expect(highlightsOf(t)).toEqual([
      ["customer:Acme", []],
      ["o01", ["top:warning", "large:warning"]],
      ["o03", []],
      ["customer:Globex", []],
      ["o02", ["top:warning"]],
      ["customer:Initech", []],
      ["o04", ["top:warning"]],
    ])
  })
})

describe("usePliantTable highlights that can't be computed", () => {
  it("reports a condition that reads a field the dataset doesn't have", () => {
    const onError = vi.fn()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const t = setup({ dataset }, onError)
    t.apply(highlight("bad", call("gt", field("missing"), value(1))))
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toEqual([])
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no highlight bad"
    )
  })

  it("reports a condition that isn't true or false", () => {
    const onError = vi.fn()
    const t = setup({ dataset }, onError)
    t.apply(highlight("bad", field("value")))
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toEqual([])
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no highlight bad: its condition isn't true or false"
    )
  })

  it("shows none without a dataset, and says so", () => {
    const onError = vi.fn()
    const t = setup({ dataset: undefined }, onError)
    t.apply(highlight("large", over(25)))
    expect(highlightsOf(t).flatMap(([, ids]) => ids)).toEqual([])
    expect(String(onError.mock.calls[0]?.[0])).toContain(
      "orders-table has no highlight large: pass the table's dataset"
    )
  })
})
