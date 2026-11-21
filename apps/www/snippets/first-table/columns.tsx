// #region columns
"use client"

import { createColumnHelper } from "@tanstack/react-table"

import { PliantDataTableColumnHeader } from "@/components/pliant/pliant-data-table-column-header"
import type { PliantDataTableFeatures } from "@/components/pliant/pliant-data-table-features"

import type { Order } from "./data"

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const columnHelper = createColumnHelper<PliantDataTableFeatures, Order>()

export const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    meta: { label: "Order" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("customer", {
    meta: { label: "Customer" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("region", {
    meta: { label: "Region" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("status", {
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <span className="capitalize">{row.original.status}</span>
    ),
  }),
  columnHelper.accessor("value", {
    meta: { label: "Value" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => rupees.format(row.original.value),
  }),
  columnHelper.accessor("notes", {
    meta: { label: "Notes" },
    enableSorting: false,
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
])
// #endregion columns
