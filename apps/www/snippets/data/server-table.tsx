// #region table
"use client"

import { useEffect, useState } from "react"
import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/components/pliant/pliant-data-table-pagination"

import { columns } from "./columns"
import type { Order } from "./data"

export function OrdersTable({ rowCount }: { rowCount: number }) {
  const [rows, setRows] = useState<Order[]>([])
  const options = usePliantTable(
    {
      features: pliantDataTableFeatures,
      data: rows,
      columns,
      manualSorting: true,
      manualFiltering: true,
      manualPagination: true,
      rowCount,
    },
    { id: "orders-table" }
  )
  const table = useTable(options)
  const { sorting, columnFilters, pagination } = table.state

  useEffect(() => {
    if (!options.ready) return
    const controller = new AbortController()
    void fetch("/api/orders/rows", {
      method: "POST",
      signal: controller.signal,
      body: JSON.stringify({
        dataset: "orders",
        sort: sorting.map(({ id, desc }) => ({
          field: id,
          dir: desc ? "desc" : "asc",
        })),
        filters: columnFilters.map(({ id, value }) => ({
          field: id,
          ...(value as object),
        })),
        page: { index: pagination.pageIndex, size: pagination.pageSize },
      }),
    })
      .then((response) => response.json())
      .then((body: { rows: Order[] }) => {
        setRows(body.rows)
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
    }
  }, [options.ready, sorting, columnFilters, pagination])

  return (
    <div className="flex flex-col gap-4">
      <PliantDataTable table={table} aria-label="Orders" />
      <PliantDataTablePagination table={table} rows="orders" />
    </div>
  )
}
// #endregion table
