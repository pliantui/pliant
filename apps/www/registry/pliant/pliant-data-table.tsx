"use client"

import type { CSSProperties } from "react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { PliantDataTableFeatures } from "./pliant-data-table-features"

declare module "@pliantui/react" {
  interface PliantMessages {
    dataTableNoResults: string
    dataTableTotals: string
  }
}

const tableMessages = {
  dataTableNoResults: "No results.",
  dataTableTotals: "All rows",
} satisfies Partial<PliantMessages>

const ariaSort = { asc: "ascending", desc: "descending" } as const

// Pinned cells need a solid background to cover what scrolls under them,
// with the row's hover tint layered on top so hovered rows stay even.
const pinnedClassName =
  "data-pinned:bg-background [tr:hover>&]:data-pinned:bg-linear-to-r [tr:hover>&]:data-pinned:from-muted/50 [tr:hover>&]:data-pinned:to-muted/50"

const defaultNumber = new Intl.NumberFormat("en")

function defaultFormatAggregate(value: unknown) {
  if (typeof value === "number") {
    return defaultNumber.format(value)
  }
  return typeof value === "string" || typeof value === "boolean"
    ? String(value)
    : "—"
}

function getColumnStyles<TData extends RowData>(
  column: Column<PliantDataTableFeatures, TData>
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

/**
 * A table that renders a TanStack table with the options from
 * `usePliantTable`: column headers, rows, and, when users group the rows,
 * a row per group with a button that expands it and an aggregate in each
 * aggregated cell. Columns with `meta.pliant` get their total in a footer.
 * Pinned columns stay in place while the table scrolls sideways.
 *
 * The table scrolls inside a focusable region, so keyboard users can scroll
 * it. Name it with `aria-labelledby` or `aria-label`. Put the title, the
 * column menu and the pagination around it, as in `PliantDataTableViewOptions`
 * and `PliantDataTablePagination`.
 */
function PliantDataTable<TData extends RowData>({
  table,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  formatAggregate = defaultFormatAggregate,
}: {
  /** The table from `useTable`, with the options from `usePliantTable`. */
  table: ReactTable<PliantDataTableFeatures, TData>
  /** The name of the table, when no element on the page names it. */
  "aria-label"?: string
  /** The id of the element that names the table, such as its title. */
  "aria-labelledby"?: string
  /**
   * Formats an aggregated value, and a group's row count, given the unit
   * from the column's `meta.pliant`, if any. Defaults to English digit
   * grouping for numbers.
   */
  formatAggregate?: (value: unknown, unit: string | undefined) => string
}) {
  const messages = usePliantMessages(tableMessages)
  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const hasAggregates = leafColumns.some(
    (column) => column.columnDef.meta?.pliant
  )

  return (
    // The region scrolls instead of the table's own container, so it can
    // take focus and scroll from the keyboard.
    <div
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-border outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_[data-slot=table-container]]:overflow-visible"
    >
      {/* Every column keeps its size, and an empty filler cell at the end of
      each row takes the room left over, so the table fills its container. */}
      <Table
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
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
          {rows.length ? (
            rows.map((row) => (
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
                          (
                          {formatAggregate(row.getLeafRows().length, undefined)}
                          )
                        </span>
                      </Button>
                    ) : cell.getIsAggregated() ? (
                      <div className="pr-4 text-right font-medium tabular-nums">
                        {formatAggregate(
                          cell.getValue(),
                          cell.column.columnDef.meta?.pliant?.unit
                        )}
                      </div>
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
                colSpan={leafColumns.length + 1}
                className="h-24 text-center"
              >
                {messages.dataTableNoResults}
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
                    messages.dataTableTotals
                  ) : null}
                </TableCell>
              ))}
              <TableCell aria-hidden className="p-0" />
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  )
}

export { PliantDataTable }
