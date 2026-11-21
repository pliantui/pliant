// #region table
"use client"

import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"

import { columns } from "./columns"
import type { Order } from "./data"

export function OrdersTable({ data }: { data: Order[] }) {
  const table = useTable(
    usePliantTable(
      { features: pliantDataTableFeatures, data, columns },
      { id: "orders-table" } // [!code highlight]
    )
  )

  return <PliantDataTable table={table} aria-label="Orders" />
}
// #endregion table
