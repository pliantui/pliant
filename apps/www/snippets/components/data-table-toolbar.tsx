// #region toolbar
"use client"

import type { ReactTable } from "@tanstack/react-table"

import type { PliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"
import { PliantDataTableToolbar } from "@/components/pliant/pliant-data-table-toolbar"

import type { Order } from "../first-table/data"

export function OrdersToolbar({
  table,
}: {
  table: ReactTable<PliantDataTableFeatures, Order>
}) {
  return (
    <PliantDataTableToolbar
      table={table}
      node="orders-table"
      filters={[
        { field: "customer", control: "search" },
        { field: "status", control: "multi-select" },
      ]}
      presets={[
        {
          id: "to-chase",
          label: "To chase",
          filters: [{ field: "status", operator: "in", value: ["overdue"] }],
          sort: [{ field: "value", dir: "desc" }],
        },
      ]}
    />
  )
}
// #endregion toolbar
