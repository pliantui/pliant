"use client"

import { useId, type CSSProperties } from "react"
import { useTable, type Column } from "@tanstack/react-table"
import { ChevronDown } from "lucide-react"

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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { Order } from "../data"
import { formatNumber } from "../format"
import { columns } from "./columns"
import { features, type DataTableFeatures } from "./data-table-features"

const ariaSort = { asc: "ascending", desc: "descending" } as const

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

export function OrdersTable({ data }: { data: Order[] }) {
  const titleId = useId()
  const options = usePliantTable(
    { features, data, columns },
    { id: "orders-table" }
  )
  const table = useTable(options)
  const { pageIndex, pageSize } = table.state.pagination
  const rowCount = table.getRowCount()
  const range = rowCount
    ? `${formatNumber(pageIndex * pageSize + 1)}–${formatNumber(Math.min((pageIndex + 1) * pageSize, rowCount))} of ${formatNumber(rowCount)}`
    : "0 of 0"

  return (
    <div
      data-pliant-id="orders-table"
      data-pliant-pending={options.ready ? undefined : ""}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-lg font-semibold">
          All orders
        </h2>
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
      <div className="w-fit max-w-full overflow-hidden rounded-lg border border-border">
        <Table
          aria-labelledby={titleId}
          className="table-fixed"
          style={{ width: table.getTotalSize() }}
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
                      className="data-pinned:bg-background"
                      style={getColumnStyles(header.column)}
                    >
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
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
                      className="truncate data-pinned:bg-background"
                      style={getColumnStyles(cell.column)}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {range} orders
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
