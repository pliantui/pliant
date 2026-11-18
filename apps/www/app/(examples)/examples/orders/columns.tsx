"use client"

import { createColumnHelper } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"

import { ColumnHeader } from "./column-header"
import type { Order, OrderStatus } from "./data"
import { formatCurrency, formatDate } from "./format"
import type { OrdersTableFeatures } from "./table-features"

export const columnLabels = {
  id: "Order",
  customer: "Customer",
  region: "Region",
  status: "Status",
  value: "Value",
  createdAt: "Created",
  notes: "Notes",
} as const

const statusVariants = {
  paid: "default",
  pending: "secondary",
  overdue: "destructive",
  refunded: "outline",
} as const satisfies Record<OrderStatus, string>

const columnHelper = createColumnHelper<OrdersTableFeatures, Order>()

export const columns = columnHelper.columns([
  columnHelper.accessor("id", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.id} />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("id")}</span>
    ),
  }),
  columnHelper.accessor("customer", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.customer} />
    ),
  }),
  columnHelper.accessor("region", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.region} />
    ),
  }),
  columnHelper.accessor("status", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.status} />
    ),
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
    header: ({ column }) => (
      <div className="-mr-2.5 flex justify-end">
        <ColumnHeader column={column} title={columnLabels.value} />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {formatCurrency(row.original.value)}
      </div>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.createdAt} />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
  }),
  columnHelper.accessor("notes", {
    header: ({ column }) => (
      <ColumnHeader column={column} title={columnLabels.notes} />
    ),
    cell: ({ row }) =>
      row.original.notes || <span className="text-muted-foreground">-</span>,
  }),
])
