// @vitest-environment happy-dom
import * as React from "react"
import { createColumnHelper, useTable } from "@tanstack/react-table"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { Op } from "@pliantui/contract"
import {
  PliantRoot,
  usePliantStore,
  type PliantMessages,
  type PliantStore,
  type StorageAdapter,
} from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "./pliant-data-table"
import { PliantDataTableColumnHeader } from "./pliant-data-table-column-header"
import {
  pliantDataTableFeatures,
  type PliantDataTableFeatures,
} from "./pliant-data-table-features"
import { PliantDataTablePagination } from "./pliant-data-table-pagination"
import { PliantDataTableViewOptions } from "./pliant-data-table-view-options"

interface Order {
  id: string
  status: "paid" | "open"
  value: number
}

const orders: Order[] = Array.from({ length: 25 }, (_, index) => ({
  id: `o${String(index + 1).padStart(2, "0")}`,
  status: index % 5 === 0 ? "open" : "paid",
  value: (index + 1) * 10,
}))

const dataset = {
  fields: {
    id: { type: "id" },
    status: { type: "string" },
    value: { type: "currency", currency: "INR" },
  },
  timeZone: "UTC",
} as const

const helper = createColumnHelper<PliantDataTableFeatures, Order>()

const columns = helper.columns([
  helper.accessor("id", {
    enableHiding: false,
    meta: { label: "Order" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("status", {
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("value", {
    meta: { label: "Value" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
])

const storage: StorageAdapter = {
  load: () => ({ personal: [] }),
  save: (_surface, overlay) => ({
    overlay,
    etag: crypto.randomUUID(),
    version: 1,
    updatedAt: new Date().toISOString(),
  }),
}

let store: PliantStore | undefined

function Orders({
  data,
  rows,
  formatAggregate,
}: {
  data: Order[]
  rows?: string
  formatAggregate?: (value: unknown, unit: string | undefined) => string
}) {
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: "orders-table", dataset }
  )
  const table = useTable(options)
  const actions = usePliantStore()
  React.useLayoutEffect(() => {
    store = actions
  }, [actions])
  return (
    <>
      <h2 id="title">Orders</h2>
      <PliantDataTableViewOptions table={table} />
      <PliantDataTable
        table={table}
        aria-labelledby="title"
        {...(formatAggregate && { formatAggregate })}
      />
      <PliantDataTablePagination table={table} {...(rows && { rows })} />
    </>
  )
}

function renderOrders(
  props: React.ComponentProps<typeof Orders> = { data: orders },
  messages?: Partial<PliantMessages>
) {
  return render(
    <PliantRoot surface="/orders" storage={storage} messages={messages}>
      <Orders {...props} />
    </PliantRoot>
  )
}

function apply(...ops: Op[]) {
  act(() => {
    expect(store?.applyOps("personal", ops).success).toBe(true)
  })
}

const groupByStatus: Op[] = [
  { op: "setGroupBy", target: "orders-table", fields: ["status"] },
  {
    op: "addAggregate",
    target: "orders-table",
    id: "total-value",
    label: "Total value",
    expr: { fn: "sum", args: [{ field: "value" }] },
  },
  {
    op: "addAggregate",
    target: "orders-table",
    id: "order-count",
    label: "Orders",
    expr: { fn: "count", args: [] },
  },
]

function table() {
  return screen.getByRole("table", { name: "Orders" })
}

function section(name: "tbody" | "tfoot") {
  const element = table().querySelector<HTMLElement>(name)
  if (!element) throw new Error(`No ${name}`)
  return element
}

function bodyRows() {
  return within(section("tbody")).getAllByRole("row")
}

function bodyRow(index: number) {
  const row = bodyRows()[index]
  if (!row) throw new Error(`No row ${String(index)}`)
  return row
}

function rowOf(element: HTMLElement) {
  const row = element.closest("tr")
  if (!row) throw new Error("Not in a row")
  return row
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
})

describe("PliantDataTable", () => {
  it("names the scrolling region and the table by the given element", () => {
    renderOrders()

    const region = screen.getByRole("region", { name: "Orders" })
    expect(region.tabIndex).toBe(0)
    expect(region.contains(table())).toBe(true)
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toContain("Order")
  })

  it("shows a message and no footer when there are no rows", () => {
    renderOrders({ data: [] })

    expect(within(table()).getByText("No results.")).toBeTruthy()
    expect(table().querySelector("tfoot")).toBeNull()
    expect(screen.getByText("0 of 0 rows")).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled
    ).toBe(true)
  })

  it("shows a page of rows and moves between pages", () => {
    renderOrders({ data: orders, rows: "orders" })

    expect(bodyRows()).toHaveLength(10)
    expect(screen.getByText("1–10 of 25 orders")).toBeTruthy()
    const previous = screen.getByRole<HTMLButtonElement>("button", {
      name: "Previous",
    })
    const next = screen.getByRole<HTMLButtonElement>("button", {
      name: "Next",
    })
    expect(previous.disabled).toBe(true)

    fireEvent.click(next)
    expect(screen.getByText("11–20 of 25 orders")).toBeTruthy()
    expect(within(bodyRow(0)).getByText("o11")).toBeTruthy()

    fireEvent.click(next)
    expect(screen.getByText("21–25 of 25 orders")).toBeTruthy()
    expect(bodyRows()).toHaveLength(5)
    expect(next.disabled).toBe(true)

    fireEvent.click(previous)
    expect(screen.getByText("11–20 of 25 orders")).toBeTruthy()
  })

  it("sorts by a column header and says which way", () => {
    renderOrders()
    const header = () =>
      within(table()).getByRole("columnheader", { name: "Value" })

    expect(header().getAttribute("aria-sort")).toBeNull()
    fireEvent.click(within(header()).getByRole("button", { name: "Value" }))
    expect(header().getAttribute("aria-sort")).toBe("ascending")
    expect(within(bodyRow(0)).getByText("o01")).toBeTruthy()

    fireEvent.click(within(header()).getByRole("button", { name: "Value" }))
    expect(header().getAttribute("aria-sort")).toBe("descending")
    expect(within(bodyRow(0)).getByText("o25")).toBeTruthy()
  })

  it("hides and shows columns from the columns menu", async () => {
    renderOrders()
    const headers = () =>
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent)

    expect(headers()).toContain("Status")
    fireEvent.keyDown(screen.getByRole("button", { name: "Columns" }), {
      key: "Enter",
    })
    await settle()
    expect(
      screen.getAllByRole("menuitemcheckbox").map((item) => item.textContent)
    ).toEqual(["Status", "Value"])
    const status = screen.getByRole("menuitemcheckbox", { name: "Status" })
    expect(status.getAttribute("aria-checked")).toBe("true")

    fireEvent.click(status)
    await settle()
    expect(headers()).not.toContain("Status")

    fireEvent.keyDown(screen.getByRole("button", { name: "Columns" }), {
      key: "Enter",
    })
    await settle()
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Status" }))
    await settle()
    expect(headers()).toContain("Status")
  })

  it("shows a row per group, expands it and totals the footer", () => {
    renderOrders({ data: orders, rows: "orders" })
    apply(...groupByStatus)

    expect(screen.getByText("1–2 of 2 rows")).toBeTruthy()
    expect(bodyRows()).toHaveLength(2)
    const open = within(table()).getByRole("button", { name: /open/ })
    const paid = within(table()).getByRole("button", { name: /paid/ })
    expect(open.getAttribute("aria-expanded")).toBe("false")
    expect(open.textContent).toContain("(5)")
    expect(paid.textContent).toContain("(20)")

    const openRow = rowOf(open)
    expect(openRow.textContent).toContain("550")
    expect(openRow.textContent).toContain("5")

    fireEvent.click(open)
    expect(open.getAttribute("aria-expanded")).toBe("true")
    expect(bodyRows()).toHaveLength(7)
    expect(within(bodyRow(1)).getByText("o01")).toBeTruthy()

    fireEvent.click(open)
    expect(open.getAttribute("aria-expanded")).toBe("false")
    expect(bodyRows()).toHaveLength(2)

    const footer = within(section("tfoot")).getByRole("row")
    expect(footer.textContent).toContain("All rows")
    expect(footer.textContent).toContain("3,250")
    expect(footer.textContent).toContain("25")
  })

  it("formats aggregates and group counts with the given function", () => {
    renderOrders({
      data: orders,
      formatAggregate: (value, unit) =>
        `${String(value)}${unit ? ` ${unit}` : ""}!`,
    })
    apply(...groupByStatus)

    expect(
      within(table()).getByRole("button", { name: /open/ }).textContent
    ).toContain("(5!)")
    expect(
      rowOf(within(table()).getByRole("button", { name: /open/ })).textContent
    ).toContain("550 INR!")
    const footer = section("tfoot")
    expect(footer.textContent).toContain("3250 INR!")
    expect(footer.textContent).toContain("25!")
  })

  it("shows the text the root was given", () => {
    renderOrders(
      { data: [] },
      {
        dataTableNoResults: "Nothing here",
        dataTableNoRows: (rows) => `none ${rows}`,
        dataTableRows: "lines",
        dataTablePrevious: "Back",
        dataTableNext: "Forward",
        dataTableColumns: "View",
      }
    )

    expect(within(table()).getByText("Nothing here")).toBeTruthy()
    expect(screen.getByText("none lines")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Forward" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "View" })).toBeTruthy()
  })
})
