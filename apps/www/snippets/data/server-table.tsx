// #region table
"use client"

import { useEffect, useState } from "react"
import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"
import type { ServerQuery } from "@pliantui/server/sql"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/components/pliant/pliant-data-table-pagination"

import { columns } from "./columns"
import type { Order } from "./data"

interface Page {
  rows: Order[]
  rowCount: number
}

export function OrdersTable() {
  const [page, setPage] = useState<Page>({ rows: [], rowCount: 0 })
  const options = usePliantTable(
    {
      features: pliantDataTableFeatures,
      data: page.rows,
      columns,
      manualSorting: true,
      manualPagination: true,
      rowCount: page.rowCount,
    },
    { id: "orders-table" }
  )
  const table = useTable(options)
  const { sorting, pagination } = table.state

  useEffect(() => {
    if (!options.ready) return
    const query: ServerQuery = {
      dataset: "orders",
      sort: sorting.map(({ id, desc }) => ({ field: id, desc })),
      page: { index: pagination.pageIndex, size: pagination.pageSize },
    }
    const controller = new AbortController()
    void fetch("/api/orders/rows", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify(query),
    })
      .then((response) => response.json())
      .then((body: Page) => {
        setPage(body)
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
    }
  }, [options.ready, sorting, pagination])

  return (
    <div className="flex flex-col gap-4">
      <PliantDataTable table={table} aria-label="Orders" />
      <PliantDataTablePagination table={table} rows="orders" />
    </div>
  )
}
// #endregion table
