"use client"

import { createColumnHelper } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"

import type { Order, OrderStatus } from "../data"
import { formatCurrency, formatDate } from "../format"
import { DataTableColumnHeader } from "./data-table-column-header"
import type { DataTableFeatures } from "./data-table-features"

const statusVariants = {
  paid: "secondary",
  pending: "outline",
  overdue: "destructive",
  refunded: "outline",
} as const satisfies Record<OrderStatus, string>

const columnHelper = createColumnHelper<DataTableFeatures, Order>()

export const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    meta: { label: "Order" },
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("id")}</span>
    ),
  }),
  columnHelper.accessor("customer", {
    meta: { label: "Customer" },
    header: ({ column }) => <DataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("region", {
    meta: { label: "Region" },
    header: ({ column }) => <DataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("status", {
    meta: { label: "Status" },
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge variant={statusVariants[status]} className="capitalize">
          {status}
        </Badge>
      )
    },
  }),
  columnHelper.accessor("value", {
    meta: { label: "Value" },
    header: ({ column }) => (
      <div className="-mr-2.5 flex justify-end pr-4">
        <DataTableColumnHeader column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pr-4 text-right font-medium tabular-nums">
        {formatCurrency(row.original.value)}
      </div>
    ),
  }),
  columnHelper.accessor("createdAt", {
    meta: { label: "Created" },
    header: ({ column }) => <DataTableColumnHeader column={column} />,
    cell: ({ row }) => formatDate(row.original.createdAt),
  }),
  columnHelper.accessor("notes", {
    meta: { label: "Notes" },
    enableSorting: false,
    header: ({ column }) => column.columnDef.meta?.label,
    cell: ({ row }) =>
      row.original.notes || (
        <>
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
          <span className="sr-only">No notes</span>
        </>
      ),
  }),
])
