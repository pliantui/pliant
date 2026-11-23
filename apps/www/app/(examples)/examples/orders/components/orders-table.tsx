"use client"

import { use, useId } from "react"
import { useTable } from "@tanstack/react-table"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { DemoAskContext } from "@/components/demo/demo-ask-panel"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { formatNumber } from "@/lib/demo/format"
import { ordersDataset, type Order } from "@/lib/demo/schema"
import { columns } from "@/registry/blocks/orders-list/columns"
import { formatAggregate } from "@/registry/blocks/orders-list/format-aggregate"
import { PliantDataTable } from "@/registry/pliant/pliant-data-table"
import { pliantDataTableFeatures } from "@/registry/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/registry/pliant/pliant-data-table-pagination"
import {
  PliantDataTableToolbar,
  type PliantDataTableFilterControl,
  type PliantDataTablePreset,
  type PliantDataTableSortOption,
} from "@/registry/pliant/pliant-data-table-toolbar"

import { DataTableColumnMenu } from "./data-table-column-menu"
import { DataTableGroupMenu } from "./data-table-group-menu"
import {
  DataTableHighlightMenu,
  formatHighlight,
} from "./data-table-highlight-menu"

const nodeId = "orders-table"

const filters: PliantDataTableFilterControl[] = [
  { field: "customer", control: "search" },
  { field: "status", control: "multi-select" },
  { field: "region", control: "multi-select" },
]

const sortOptions: PliantDataTableSortOption[] = [
  {
    id: "newest",
    label: "Newest first",
    sort: [{ field: "createdAt", dir: "desc" }],
  },
  {
    id: "largest",
    label: "Largest first",
    sort: [{ field: "value", dir: "desc" }],
  },
]

const presets: PliantDataTablePreset[] = [
  {
    id: "to-chase",
    label: "To chase",
    filters: [
      { field: "status", operator: "in", value: ["overdue", "pending"] },
    ],
    sort: [{ field: "value", dir: "desc" }],
  },
]

function formatValue(value: string | number | boolean) {
  const text = String(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function OrdersTable({ data }: { data: Order[] }) {
  const titleId = useId()
  const node = usePliantNodeProps(nodeId)
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: nodeId, dataset: ordersDataset }
  )
  const table = useTable(options)
  const ask = use(DemoAskContext)

  return (
    <div {...node} className="flex flex-col gap-4">
      <h2 id={titleId} className="text-lg font-semibold">
        All orders
      </h2>
      <PliantDataTableToolbar
        table={table}
        node={nodeId}
        filters={filters}
        sortOptions={sortOptions}
        presets={presets}
        formatValue={formatValue}
        customize={{
          onAsk: ask
            ? () => {
                ask.ask(nodeId)
              }
            : undefined,
          unavailable: <UnfinishedDot />,
        }}
      >
        <DataTableColumnMenu node={nodeId} />
        <DataTableHighlightMenu node={nodeId} />
        <DataTableGroupMenu
          node={nodeId}
          value={table.state.grouping[0] ?? "none"}
        />
      </PliantDataTableToolbar>
      <PliantDataTable
        table={table}
        aria-labelledby={titleId}
        formatAggregate={formatAggregate}
        formatHighlight={formatHighlight}
      />
      <PliantDataTablePagination
        table={table}
        rows="orders"
        formatNumber={formatNumber}
      />
    </div>
  )
}
