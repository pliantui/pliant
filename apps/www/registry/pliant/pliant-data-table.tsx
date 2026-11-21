"use client"

import type { ComponentProps, CSSProperties, ReactNode } from "react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Star,
  TriangleAlert,
} from "lucide-react"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"
import {
  getPliantHighlights,
  type PliantHighlight,
} from "@pliantui/react/table"

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
    dataTableHighlighted: (names: string[]) => string
    dataTableHighlightEmphasis: string
    dataTableHighlightSuccess: string
    dataTableHighlightWarning: string
    dataTableHighlightDanger: string
  }
}

const tableMessages = {
  dataTableNoResults: "No results.",
  dataTableTotals: "All rows",
  dataTableHighlighted: (names) => `Highlighted: ${names.join(", ")}`,
  dataTableHighlightEmphasis: "Emphasis",
  dataTableHighlightSuccess: "Success",
  dataTableHighlightWarning: "Warning",
  dataTableHighlightDanger: "Danger",
} satisfies Partial<PliantMessages>

type Tone = PliantHighlight["tone"]

const toneMessages = {
  emphasis: "dataTableHighlightEmphasis",
  success: "dataTableHighlightSuccess",
  warning: "dataTableHighlightWarning",
  danger: "dataTableHighlightDanger",
} as const satisfies Record<Tone, keyof typeof tableMessages>

// A highlighted row is tinted with its tone, and its first cell gets the
// tone's icon, so the highlight doesn't rest on color alone. The tint is an
// image over each cell's background, so the row's hover and a pinned cell's
// solid background still show under it.
const tones = {
  emphasis: {
    row: "[&>td]:bg-linear-to-r [&>td]:from-primary/8 [&>td]:to-primary/8",
    icon: <Star aria-hidden className="size-4 shrink-0 text-primary" />,
  },
  success: {
    row: "[&>td]:bg-linear-to-r [&>td]:from-emerald-500/14 [&>td]:to-emerald-500/14",
    icon: (
      <CircleCheck
        aria-hidden
        className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
      />
    ),
  },
  warning: {
    row: "[&>td]:bg-linear-to-r [&>td]:from-amber-500/16 [&>td]:to-amber-500/16",
    icon: (
      <TriangleAlert
        aria-hidden
        className="size-4 shrink-0 text-amber-700 dark:text-amber-400"
      />
    ),
  },
  danger: {
    row: "[&>td]:bg-linear-to-r [&>td]:from-destructive/12 [&>td]:to-destructive/12",
    icon: (
      <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
    ),
  },
} satisfies Record<Tone, { row: string; icon: ReactNode }>

const ariaSort = { asc: "ascending", desc: "descending" } as const

// Pinned cells need a solid background to cover what scrolls under them,
// with the row's hover tint layered on top so hovered rows stay even.
const pinnedClassName =
  "data-pinned:bg-background [tr:hover>&]:data-pinned:bg-linear-to-r [tr:hover>&]:data-pinned:from-muted/50 [tr:hover>&]:data-pinned:to-muted/50"

const defaultNumber = new Intl.NumberFormat("en")

function defaultFormatNumber(value: number) {
  return defaultNumber.format(value)
}

function PliantDataTableHighlight({
  tone,
  label,
}: {
  tone: Tone
  label: string
}) {
  return (
    <>
      {tones[tone].icon}
      <span className="sr-only">{label}</span>
    </>
  )
}

function defaultFormatAggregate(
  value: unknown,
  unit: string | undefined,
  format?: PliantDataTableFormat
) {
  return formatPliantValue(value, format, unit)
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
 * aggregates, get their total in a footer. Derived columns
 * (`meta.pliant.derived`) get a sortable header and show their values by
 * their `format`.
 * Pinned columns stay in place while the table scrolls sideways.
 *
 * A row with highlights (`addHighlight` ops whose condition is true for it)
 * is tinted with the tone of the one applied last, and its first cell shows
 * that tone's icon, with text for screen readers that names every highlight
 * it has, by `formatHighlight`.
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
  formatHighlight,
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
     * Defaults to `formatPliantValue`: the `format` when there is one, else
     * the unit (a percentage, or a currency rounded to its minor units), else
     * English digit grouping for numbers.
     */
    formatAggregate?: (
      value: unknown,
      unit: string | undefined,
      format?: PliantDataTableFormat
    ) => string
    /** Formats the number of rows in a group. */
    formatNumber?: (value: number) => string
    /**
     * Names a highlight for screen readers, as in "Highlighted: Overdue".
     * Defaults to its tone, such as "Warning".
     */
    formatHighlight?: (highlight: PliantHighlight) => string
  }) {
  const messages = usePliantMessages(tableMessages)
  const rows = table.getRowModel().rows
  const leafColumns = table.getVisibleLeafColumns()
  const hasAggregates = leafColumns.some(isAggregate)
  const totalsIndex = leafColumns.findIndex((column) => !isAggregate(column))
  const nameHighlight = (highlight: PliantHighlight) =>
    formatHighlight?.(highlight) ?? messages[toneMessages[highlight.tone]]

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
            rows.map((row) => {
              const highlights = getPliantHighlights(row)
              const tone = highlights.at(-1)?.tone
              return (
                <TableRow
                  key={row.id}
                  data-highlight={tone}
                  className={cn("border-border", tone && tones[tone].row)}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const content = cell.getIsGrouped() ? (
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
                    )
                    return (
                      <TableCell
                        key={cell.id}
                        data-pinned={cell.column.getIsPinned() || undefined}
                        className={pinnedClassName}
                        style={getColumnStyles(cell.column)}
                      >
                        {index === 0 && tone ? (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">{content}</div>
                            <PliantDataTableHighlight
                              tone={tone}
                              label={messages.dataTableHighlighted([
                                ...new Set(highlights.map(nameHighlight)),
                              ])}
                            />
                          </div>
                        ) : (
                          content
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell aria-hidden className="p-0" />
                </TableRow>
              )
            })
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
