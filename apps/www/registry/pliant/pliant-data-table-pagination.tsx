"use client"

import type { ReactTable, RowData } from "@tanstack/react-table"

import { usePliantMessages, type PliantMessages } from "@pliantui/react"

import { Button } from "@/components/ui/button"

import type { PliantDataTableFeatures } from "./pliant-data-table-features"

declare module "@pliantui/react" {
  interface PliantMessages {
    dataTableRows: string
    dataTableRange: (
      first: string,
      last: string,
      total: string,
      rows: string
    ) => string
    dataTableNoRows: (rows: string) => string
    dataTablePrevious: string
    dataTableNext: string
  }
}

const paginationMessages = {
  dataTableRows: "rows",
  dataTableRange: (first, last, total, rows) =>
    `${first}–${last} of ${total} ${rows}`,
  dataTableNoRows: (rows) => `0 of 0 ${rows}`,
  dataTablePrevious: "Previous",
  dataTableNext: "Next",
} satisfies Partial<PliantMessages>

const defaultNumber = new Intl.NumberFormat("en")

function defaultFormatNumber(value: number) {
  return defaultNumber.format(value)
}

/**
 * The range of rows on the page, announced as it changes, and buttons for
 * the previous and next page.
 */
function PliantDataTablePagination<TData extends RowData>({
  table,
  rows,
  formatNumber = defaultFormatNumber,
}: {
  /** The table from `useTable`, with the options from `usePliantTable`. */
  table: ReactTable<PliantDataTableFeatures, TData>
  /**
   * What the rows are called, such as "orders". Defaults to the
   * `dataTableRows` message. A grouped table always uses the message, since
   * its rows are groups as well as records.
   */
  rows?: string
  /** Formats the numbers in the range. Defaults to English digit grouping. */
  formatNumber?: (value: number) => string
}) {
  const messages = usePliantMessages(paginationMessages)
  const { pageIndex, pageSize } = table.state.pagination
  const rowCount = table.getRowCount()
  const name = table.state.grouping.length
    ? messages.dataTableRows
    : (rows ?? messages.dataTableRows)

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {rowCount
          ? messages.dataTableRange(
              formatNumber(pageIndex * pageSize + 1),
              formatNumber(Math.min((pageIndex + 1) * pageSize, rowCount)),
              formatNumber(rowCount),
              name
            )
          : messages.dataTableNoRows(name)}
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
          {messages.dataTablePrevious}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            table.nextPage()
          }}
          disabled={!table.getCanNextPage()}
        >
          {messages.dataTableNext}
        </Button>
      </div>
    </div>
  )
}

export { PliantDataTablePagination }
