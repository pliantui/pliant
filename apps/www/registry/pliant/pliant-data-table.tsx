"use client"

import type { ComponentProps, CSSProperties } from "react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"
import { cn } from "cn"
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

import { PliantDataTableColumnHeader } from "./pliant-data-table-column-header"
import type { PliantDataTableFeatures } from "./pliant-data-table-features"
import {
  formatPliantValue,
  type PliantDataTableFormat,
} from "./pliant-data-table-format"

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

function defaultFormatNumber(value: number) {
  return defaultNumber.format(value)
}

function defaultFormatAggregate(
  value: unknown,
  unit: string | undefined,
  format?: PliantDataTableFormat
) {
  if (format) {
    return formatPliantValue(value, format, unit)
  }
  if (typeof value === "number") {
    return defaultFormatNumber(value)
  }
  return typeof value === "string" || typeof value === "boolean"
    ? String(value)
    : "—"
}

function isDerived<TData extends RowData>(
  column: Column<PliantDataTableFeatures, TData>
) {
  return column.columnDef.meta?.pliant?.derived === true
}

function isAggregate<TData extends RowData>(
  column: Column<PliantDataTableFeatures, TData>
) {
  return column.columnDef.meta?.pliant?.type !== undefined && !isDerived(column)
}

function isNumeric<TData extends RowData>(
  column: Column<PliantDataTableFeatures, TData>
) {
  const type = column.columnDef.meta?.pliant?.type
  return type === "number" || type === "integer"
}

type PliantDataTableName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never }

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
 * aggregated cell. Columns with `meta.pliant.type`, the ones Pliant
 * aggregates, get their total in a footer. Derived columns (`meta.pliant.derived`)
 * get a sortable header and show their values by their `format`.
 * Pinned columns stay in place while the table scrolls sideways.
 *
 * The table scrolls inside a focusable region, so keyboard users can scroll
 * it. Name it with `aria-labelledby` or `aria-label`; other props go to the
 * region. Put the title, the
 * column menu and the pagination around it, as in `PliantDataTableViewOptions`
 * and `PliantDataTablePagination`.
 */
function PliantDataTable<TData extends RowData>({
  table,
  formatAggregate = defaultFormatAggregate,
  formatNumber = defaultFormatNumber,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: Omit<
  ComponentProps<"div">,
  "aria-label" | "aria-labelledby" | "children" | "role" | "tabIndex"
> &
  PliantDataTableName & {
    /** The table from `useTable`, with the options from `usePliantTable`. */
    table: ReactTable<PliantDataTableFeatures, TData>
    /**
     * Formats an aggregated or derived value, given the unit and, for a
     * derived column, the `format` from the column's `meta.pliant`, if any.
     * Defaults to the `format` when there is one (see `formatPliantValue`),
     * and English digit grouping for numbers otherwise.
     */
    formatAggregate?: (
      value: unknown,
      unit: string | undefined,
      format?: PliantDataTableFormat
    ) => string
    /** Formats the number of rows in a group. */
    formatNumber?: (value: number) => string
  }) {
  const messages = usePliantMessages(tableMessages)
  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const hasAggregates = leafColumns.some(isAggregate)
  const totalsIndex = leafColumns.findIndex((column) => !isAggregate(column))

  return (
    // The region scrolls instead of the table's own container, so it can
    // take focus and scroll from the keyboard.
    <div
      {...props}
      data-slot="pliant-data-table"
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={0}
      className={cn(
        "overflow-x-auto rounded-lg border border-border outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_[data-slot=table-container]]:overflow-visible",
        className
      )}
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
                    {header.isPlaceholder ? null : isDerived(header.column) ? (
                      <div
                        className={
                          isNumeric(header.column)
                            ? "-mr-2.5 flex justify-end pr-4"
                            : undefined
                        }
                      >
                        <PliantDataTableColumnHeader column={header.column} />
                      </div>
                    ) : (
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
                          ({formatNumber(row.getLeafRows().length)})
                        </span>
                      </Button>
                    ) : cell.getIsAggregated() ? (
                      <div className="pr-4 text-right font-medium tabular-nums">
                        {formatAggregate(
                          cell.getValue(),
                          cell.column.columnDef.meta?.pliant?.unit
                        )}
                      </div>
                    ) : row.getIsGrouped() ? null : isDerived(cell.column) ? (
                      <div
                        className={cn(
                          "tabular-nums",
                          isNumeric(cell.column) && "pr-4 text-right"
                        )}
                      >
                        {formatAggregate(
                          cell.getValue(),
                          cell.column.columnDef.meta?.pliant?.unit,
                          cell.column.columnDef.meta?.pliant?.format
                        )}
                      </div>
                    ) : (
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
                  {isAggregate(column) ? (
                    <div className="pr-4 text-right tabular-nums">
                      {formatAggregate(
                        column.getAggregationValue<unknown>(),
                        column.columnDef.meta?.pliant?.unit
                      )}
                    </div>
                  ) : index === totalsIndex ? (
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
