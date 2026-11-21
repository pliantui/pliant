"use client"

import { useId, type CSSProperties } from "react"
import { useTable, type Cell, type Column } from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { Order } from "../data"
import { ordersDataset } from "../dataset"
import { formatAggregate, formatNumber } from "../format"
import { columns } from "./columns"
import { features, type DataTableFeatures } from "./data-table-features"
import { DataTableGroupMenu } from "./data-table-group-menu"

const ariaSort = { asc: "ascending", desc: "descending" } as const

// Pinned cells need a solid background to cover what scrolls under them,
// with the row's hover tint layered on top so hovered rows stay even.
const pinnedClassName =
  "data-pinned:bg-background [tr:hover>&]:data-pinned:bg-linear-to-r [tr:hover>&]:data-pinned:from-muted/50 [tr:hover>&]:data-pinned:to-muted/50"

function getColumnStyles(
  column: Column<DataTableFeatures, Order>
): CSSProperties {
  const pinned = column.getIsPinned()
  const isLastStart = pinned === "start" && column.getIsLastColumn("start")
  const isFirstEnd = pinned === "end" && column.getIsFirstColumn("end")
  return {
    position: pinned ? "sticky" : undefined,
    left: pinned === "start" ? column.getStart("start") : undefined,
    right: pinned === "end" ? column.getAfter("end") : undefined,
    zIndex: pinned ? 1 : undefined,
    boxShadow: isLastStart
      ? "inset -1px 0 var(--border)"
      : isFirstEnd
        ? "inset 1px 0 var(--border)"
        : undefined,
    width: column.getSize(),
  }
}

const nodeId = "orders-table"

function AggregatedValue({ cell }: { cell: Cell<DataTableFeatures, Order> }) {
  const value = cell.getValue()
  return (
    <div className="pr-4 text-right font-medium tabular-nums">
      {formatAggregate(value, cell.column.columnDef.meta?.pliant?.unit)}
    </div>
  )
}

export function OrdersTable({ data }: { data: Order[] }) {
  const titleId = useId()
  const node = usePliantNodeProps(nodeId)
  const options = usePliantTable(
    { features, data, columns },
    { id: nodeId, dataset: ordersDataset }
  )
  const table = useTable(options)
  const { pageIndex, pageSize } = table.state.pagination
  const rowCount = table.getRowCount()
  const grouping = table.state.grouping
  const leafColumns = table.getVisibleLeafColumns()
  const hasAggregates = leafColumns.some(
    (column) => column.columnDef.meta?.pliant
  )
  const range = rowCount
    ? `${formatNumber(pageIndex * pageSize + 1)}–${formatNumber(Math.min((pageIndex + 1) * pageSize, rowCount))} of ${formatNumber(rowCount)}`
    : "0 of 0"

  return (
    <div {...node} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold">
          All orders
        </h2>
        <div className="flex gap-2">
          <DataTableGroupMenu node={nodeId} value={grouping[0] ?? "none"} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Columns <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => {
                      column.toggleVisibility(value)
                    }}
                  >
                    {column.columnDef.meta?.label}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* The region scrolls instead of the table's own container, so it can
      take focus and scroll from the keyboard. */}
      <div
        role="region"
        aria-labelledby={titleId}
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_[data-slot=table-container]]:overflow-visible"
      >
        {/* Every column keeps its size, and an empty filler cell at the end
        of each row takes the room left over, so the table fills its
        container. */}
        <Table
          aria-labelledby={titleId}
          className="table-fixed"
          style={{ minWidth: table.getTotalSize() }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border">
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted ? ariaSort[sorted] : undefined}
                      data-pinned={header.column.getIsPinned() || undefined}
                      className={pinnedClassName}
                      style={getColumnStyles(header.column)}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
                <TableHead aria-hidden className="p-0" />
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="border-border">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      data-pinned={cell.column.getIsPinned() || undefined}
                      className={pinnedClassName}
                      style={getColumnStyles(cell.column)}
                    >
                      {cell.getIsGrouped() ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2.5"
                          aria-expanded={row.getIsExpanded()}
                          onClick={row.getToggleExpandedHandler()}
                        >
                          <ChevronRight
                            className={row.getIsExpanded() ? "rotate-90" : ""}
                          />
                          <table.FlexRender cell={cell} />
                          <span className="text-muted-foreground">
                            ({formatNumber(row.getLeafRows().length)})
                          </span>
                        </Button>
                      ) : cell.getIsAggregated() ? (
                        <AggregatedValue cell={cell} />
                      ) : row.getIsGrouped() ? null : (
                        <table.FlexRender cell={cell} />
                      )}
                    </TableCell>
                  ))}
                  <TableCell aria-hidden className="p-0" />
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length + 1}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {hasAggregates ? (
            <TableFooter>
              <TableRow className="border-border">
                {leafColumns.map((column, index) => (
                  <TableCell
                    key={column.id}
                    data-pinned={column.getIsPinned() || undefined}
                    className={pinnedClassName}
                    style={getColumnStyles(column)}
                  >
                    {column.columnDef.meta?.pliant ? (
                      <div className="pr-4 text-right tabular-nums">
                        {formatAggregate(
                          column.getAggregationValue<unknown>(),
                          column.columnDef.meta.pliant.unit
                        )}
                      </div>
                    ) : index === 0 ? (
                      "All rows"
                    ) : null}
                  </TableCell>
                ))}
                <TableCell aria-hidden className="p-0" />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {range} {grouping.length ? "rows" : "orders"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              table.previousPage()
            }}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              table.nextPage()
            }}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
