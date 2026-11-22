"use client"

import { useTable } from "@tanstack/react-table"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { ordersDataset, type Order } from "@/lib/demo/schema"
import { columns } from "@/registry/blocks/orders-list/columns"
import { formatAggregate } from "@/registry/blocks/orders-list/format-aggregate"
import { PliantDataTable } from "@/registry/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/registry/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/registry/pliant/pliant-data-table-pagination"
import { PliantDataTableViewOptions } from "@/registry/pliant/pliant-data-table-view-options"

export function OrdersTableDemo({ data }: { data: Order[] }) {
  const node = usePliantNodeProps("orders-table")
  const table = useTable(
    usePliantTable(
      {
        features: pliantDataTableFeatures,
        data,
        columns,
        initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
      },
      { id: "orders-table", dataset: ordersDataset }
    )
  )

  return (
    <div {...node} className="flex min-w-0 flex-col gap-4">
      <div className="flex justify-end">
        <PliantDataTableViewOptions table={table} />
      </div>
      <PliantDataTable
        table={table}
        aria-label="Orders"
        formatAggregate={formatAggregate}
      />
      <PliantDataTablePagination table={table} rows="orders" />
    </div>
  )
}
