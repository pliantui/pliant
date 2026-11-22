// #region table
"use client"

import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/components/pliant/pliant-data-table-pagination"
import { PliantDataTableViewOptions } from "@/components/pliant/pliant-data-table-view-options"

import { columns } from "./columns"
import type { Order } from "./data"

export function OrdersTable({ data }: { data: Order[] }) {
  const table = useTable(
    usePliantTable(
      { features: pliantDataTableFeatures, data, columns },
      { id: "orders-table" }
    )
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PliantDataTableViewOptions table={table} />
      </div>
      <PliantDataTable table={table} aria-label="Orders" />
      <PliantDataTablePagination table={table} rows="orders" />
    </div>
  )
}
// #endregion table
