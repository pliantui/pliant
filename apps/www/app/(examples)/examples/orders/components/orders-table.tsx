"use client"

import { useId } from "react"
import { useTable } from "@tanstack/react-table"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/registry/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/registry/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/registry/pliant/pliant-data-table-pagination"
import { PliantDataTableViewOptions } from "@/registry/pliant/pliant-data-table-view-options"

import type { Order } from "../data"
import { ordersDataset } from "../dataset"
import { formatAggregate, formatNumber } from "../format"
import { columns } from "./columns"
import { DataTableGroupMenu } from "./data-table-group-menu"

const nodeId = "orders-table"

export function OrdersTable({ data }: { data: Order[] }) {
  const titleId = useId()
  const node = usePliantNodeProps(nodeId)
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: nodeId, dataset: ordersDataset }
  )
  const table = useTable(options)

  return (
    <div {...node} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold">
          All orders
        </h2>
        <div className="flex gap-2">
          <DataTableGroupMenu
            node={nodeId}
            value={table.state.grouping[0] ?? "none"}
          />
          <PliantDataTableViewOptions table={table} />
        </div>
      </div>
      <PliantDataTable
        table={table}
        aria-labelledby={titleId}
        formatAggregate={formatAggregate}
      />
      <PliantDataTablePagination
        table={table}
        rows="orders"
        formatNumber={formatNumber}
      />
    </div>
  )
}
