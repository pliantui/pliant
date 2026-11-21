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
import { PliantDataTableToolbar } from "./pliant-data-table-toolbar"

interface Order {
  id: string
  status: "paid" | "open" | "late"
  value: number
  flagged: boolean
}

const statuses = ["paid", "open", "late"] as const

const orders: Order[] = Array.from({ length: 12 }, (_, index) => ({
  id: `o${String(index + 1).padStart(2, "0")}`,
  status: statuses[index % 3] ?? "paid",
  value: (index + 1) * 10,
  flagged: index < 2,
}))

const dataset = {
  fields: {
    id: { type: "id" },
    status: { type: "enum", values: statuses },
    value: { type: "number" },
    flagged: { type: "boolean" },
  },
  timeZone: "UTC",
} as const

const helper = createColumnHelper<PliantDataTableFeatures, Order>()

const columns = helper.columns([
  helper.accessor("id", {
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
  helper.accessor("flagged", {
    meta: { label: "Flagged" },
    cell: ({ row }) => (row.original.flagged ? "yes" : "no"),
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

type ToolbarProps = Omit<
  React.ComponentProps<typeof PliantDataTableToolbar>,
  "table" | "node"
>

function Orders(props: ToolbarProps) {
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data: orders, columns },
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
      <PliantDataTableToolbar table={table} node="orders-table" {...props} />
      <PliantDataTable table={table} aria-labelledby="title" />
      <PliantDataTablePagination table={table} rows="orders" />
    </>
  )
}

async function renderOrders(props: ToolbarProps = {}) {
  render(
    <PliantRoot surface="/orders" storage={storage}>
      <Orders {...props} />
    </PliantRoot>
  )
  await settle()
}

async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}

function apply(...ops: Op[]) {
  act(() => {
    expect(store?.applyOps("personal", ops).success).toBe(true)
  })
}

function table() {
  return screen.getByRole("table", { name: "Orders" })
}

function cells(column: number) {
  const [, body] = within(table()).getAllByRole("rowgroup")
  if (!body) throw new Error("No body")
  return within(body)
    .getAllByRole("row")
    .map((row) => row.querySelectorAll("td")[column]?.textContent)
}

async function open(name: string | RegExp) {
  fireEvent.keyDown(screen.getByRole("button", { name, expanded: false }), {
    key: "Enter",
  })
  await settle()
}

async function close() {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
  await settle()
}

const filters = [
  { field: "id", control: "search" },
  { field: "status", control: "multi-select" },
] as const

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  store = undefined
})

describe("PliantDataTableToolbar", () => {
  it("filters the rows by the text in a search box", async () => {
    await renderOrders({ filters: [...filters] })

    fireEvent.change(screen.getByRole("searchbox", { name: "Order" }), {
      target: { value: "o1" },
    })

    expect(cells(0)).toEqual(["o10", "o11", "o12"])
    expect(screen.getByText("1–3 of 3 orders")).toBeTruthy()
    expect(
      screen.getByRole<HTMLInputElement>("searchbox", { name: "Order" }).value
    ).toBe("o1")
  })

  it("counts each value's rows and filters by the values picked", async () => {
    await renderOrders({ filters: [...filters] })

    await open("Status")
    expect(
      screen.getAllByRole("menuitemcheckbox").map((item) => item.textContent)
    ).toEqual(["late4", "open4", "paid4"])
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^late/ }))
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /^open/ }))

    await close()
    expect(screen.getByText("1–8 of 8 orders")).toBeTruthy()
    expect(new Set(cells(1))).toEqual(new Set(["late", "open"]))

    fireEvent.change(screen.getByRole("searchbox", { name: "Order" }), {
      target: { value: "o0" },
    })
    await open(/^Status/)
    expect(
      screen.getAllByRole("menuitemcheckbox").map((item) => item.textContent)
    ).toEqual(["late3", "open3", "paid3"])
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear filter" }))
    expect(screen.getByText("1–9 of 9 orders")).toBeTruthy()
  })

  it("filters by one value with a select, and by true with a toggle", async () => {
    await renderOrders({
      filters: [
        { field: "status", control: "select" },
        { field: "flagged", control: "toggle" },
      ],
    })

    await open("Status")
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^paid/ }))
    await settle()
    expect(new Set(cells(1))).toEqual(new Set(["paid"]))

    fireEvent.click(
      screen.getByRole("button", { name: "Flagged", pressed: false })
    )
    expect(
      screen.getByRole("button", { name: "Flagged", pressed: true })
    ).toBeTruthy()
    expect(cells(0)).toEqual(["o01"])
  })

  it("shows the filters, sort options and presets ops add", async () => {
    await renderOrders()
    expect(screen.queryByRole("searchbox")).toBeNull()
    expect(screen.queryByRole("button", { name: "Sort" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Presets" })).toBeNull()

    apply(
      {
        op: "addFilterControl",
        target: "orders-table",
        id: "find",
        field: "id",
        control: "search",
        label: "Find an order",
      },
      {
        op: "addFilterControl",
        target: "orders-table",
        id: "range",
        field: "value",
        control: "range",
      },
      {
        op: "addSortOption",
        target: "orders-table",
        id: "largest",
        label: "Largest first",
        sort: [{ field: "value", dir: "desc" }],
      },
      {
        op: "addPreset",
        target: "orders-table",
        id: "late",
        label: "Late",
        filters: [{ field: "status", operator: "eq", value: "late" }],
        sort: [{ field: "id", dir: "desc" }],
      }
    )

    expect(screen.getAllByRole("searchbox")).toHaveLength(1)
    fireEvent.change(screen.getByRole("searchbox", { name: "Find an order" }), {
      target: { value: "o12" },
    })
    expect(cells(0)).toEqual(["o12"])
    fireEvent.change(screen.getByRole("searchbox", { name: "Find an order" }), {
      target: { value: "" },
    })

    await open("Sort")
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Largest first" })
    )
    await settle()
    expect(cells(2)[0]).toBe("120")

    await open("Presets")
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Late" }))
    await settle()
    expect(cells(0)).toEqual(["o12", "o09", "o06", "o03"])
    await open("Presets")
    expect(
      screen
        .getByRole("menuitemradio", { name: "Late" })
        .getAttribute("aria-checked")
    ).toBe("true")
  })

  it("lets an op replace a listed sort option with the same id", async () => {
    await renderOrders({
      sortOptions: [
        { id: "first", label: "By order", sort: [{ field: "id", dir: "asc" }] },
      ],
    })
    apply({
      op: "addSortOption",
      target: "orders-table",
      id: "first",
      label: "By value",
      sort: [{ field: "value", dir: "desc" }],
    })

    await open("Sort")
    expect(
      screen.getAllByRole("menuitemradio").map((item) => item.textContent)
    ).toEqual(["By value"])
  })

  it("resets the table and removes what the user added", async () => {
    await renderOrders({ filters: [...filters] })
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()

    apply(
      {
        op: "setSort",
        target: "orders-table",
        sort: [{ field: "value", dir: "desc" }],
      },
      { op: "hide", target: "orders-table/columns/flagged" },
      {
        op: "addHighlight",
        target: "orders-table",
        id: "big",
        when: { fn: "gt", args: [{ field: "value" }, { value: 100 }] },
        tone: "danger",
      },
      {
        op: "addSortOption",
        target: "orders-table",
        id: "largest",
        label: "Largest first",
        sort: [{ field: "value", dir: "desc" }],
      }
    )
    fireEvent.change(screen.getByRole("searchbox", { name: "Order" }), {
      target: { value: "o1" },
    })
    expect(cells(2)).toEqual(["120", "110", "100"])
    expect(screen.getAllByText("Highlighted: Danger")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    await settle()

    expect(cells(0)).toEqual(orders.slice(0, 10).map((order) => order.id))
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toContain("Flagged")
    expect(screen.queryByText("Highlighted: Danger")).toBeNull()
    expect(screen.queryByRole("button", { name: "Sort" })).toBeNull()
    expect(
      screen.getByRole<HTMLInputElement>("searchbox", { name: "Order" }).value
    ).toBe("")
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()
  })

  it("shows Reset when a column's width or the page size changes", async () => {
    await renderOrders()
    apply({
      op: "setColumnWidth",
      target: "orders-table/columns/value",
      width: 300,
    })
    const reset = screen.getByRole("button", { name: "Reset" })
    fireEvent.click(reset)
    await settle()
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()

    act(() => {
      expect(
        store?.applyOps("session", [
          { op: "setPage", target: "orders-table", index: 0, size: 20 },
        ]).success
      ).toBe(true)
    })
    expect(screen.getByText("1–12 of 12 orders")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Reset" }))
    await settle()
    expect(screen.getByText("1–10 of 12 orders")).toBeTruthy()
  })
})
