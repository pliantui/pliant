"use client"

import { useId } from "react"
import { useTable } from "@tanstack/react-table"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { formatAggregate } from "@/lib/demo/format"
import { ordersDataset, type Order } from "@/lib/demo/schema"
import { PliantDataTable } from "@/registry/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/registry/pliant/pliant-data-table-features"

import { columns } from "../../(examples)/examples/orders/components/columns"

const nodeId = "orders-table"

export function OrdersCardTable({ data }: { data: Order[] }) {
  const titleId = useId()
  const node = usePliantNodeProps(nodeId)
  const options = usePliantTable(
    {
      features: pliantDataTableFeatures,
      data,
      columns,
      initialState: { pagination: { pageIndex: 0, pageSize: 6 } },
    },
    { id: nodeId, dataset: ordersDataset }
  )
  const table = useTable(options)

  return (
    <div {...node}>
      <h3 id={titleId} className="sr-only">
        All orders
      </h3>
      <PliantDataTable
        table={table}
        aria-labelledby={titleId}
        formatAggregate={formatAggregate}
      />
    </div>
  )
}
