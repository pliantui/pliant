"use client"

import { createColumnHelper } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { PliantDataTableColumnHeader } from "@/registry/pliant/pliant-data-table-column-header"
import type { PliantDataTableFeatures } from "@/registry/pliant/pliant-data-table-features"

import type { Order, OrderStatus } from "../data"
import { formatCurrency, formatDate } from "../format"

const statusVariants = {
  paid: "secondary",
  pending: "outline",
  overdue: "destructive",
  refunded: "outline",
} as const satisfies Record<OrderStatus, string>

const columnHelper = createColumnHelper<PliantDataTableFeatures, Order>()

export const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    size: 110,
    meta: { label: "Order" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("id")}</span>
    ),
  }),
  columnHelper.accessor("customer", {
    size: 190,
    meta: { label: "Customer" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("region", {
    size: 100,
    meta: { label: "Region" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  columnHelper.accessor("status", {
    size: 110,
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
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
    size: 130,
    meta: { label: "Value" },
    header: ({ column }) => (
      <div className="-mr-2.5 flex justify-end pr-4">
        <PliantDataTableColumnHeader column={column} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pr-4 text-right font-medium tabular-nums">
        {formatCurrency(row.original.value)}
      </div>
    ),
  }),
  columnHelper.accessor("createdAt", {
    size: 130,
    meta: { label: "Created" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
    cell: ({ row }) => formatDate(row.original.createdAt),
  }),
  columnHelper.accessor("notes", {
    size: 220,
    meta: { label: "Notes" },
    enableSorting: false,
    header: ({ column }) => column.columnDef.meta?.label,
    cell: ({ row }) =>
      row.original.notes ? (
        <div className="truncate" title={row.original.notes}>
          {row.original.notes}
        </div>
      ) : (
        <>
          <span aria-hidden className="text-muted-foreground">
            —
          </span>
          <span className="sr-only">No notes</span>
        </>
      ),
  }),
])
