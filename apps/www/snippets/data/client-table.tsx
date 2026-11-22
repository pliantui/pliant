"use client"

import { useTable } from "@tanstack/react-table"

import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"

import { columns } from "./columns"
import type { Order } from "./data"

// #region dataset
const ordersFields = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    region: { type: "enum", values: ["North", "South", "East", "West"] },
    status: {
      type: "enum",
      values: ["paid", "pending", "overdue", "refunded"],
    },
    value: { type: "currency", currency: "INR" },
    createdAt: { type: "datetime" },
    notes: { type: "text" },
  },
  timeZone: "Asia/Kolkata",
} as const

export function OrdersTable({ data }: { data: Order[] }) {
  const table = useTable(
    usePliantTable(
      { features: pliantDataTableFeatures, data, columns },
      { id: "orders-table", dataset: ordersFields }
    )
  )

  return <PliantDataTable table={table} aria-label="Orders" />
}
// #endregion dataset
