import {
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  type CellData,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table"

import type { PliantDataTableFormat } from "./pliant-data-table-format"

/**
 * The features the Pliant data table components use. Pass them to
 * `usePliantTable` as `features`; it adds the ones Pliant's ops need and
 * keeps these.
 */
export const pliantDataTableFeatures = tableFeatures({
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  expandedRowModel: createExpandedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
  },
})

export type PliantDataTableFeatures = typeof pliantDataTableFeatures

// Declaration merging requires the same type parameters as the original.
/* eslint-disable @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    /** The column's name, in its header and in the columns menu. */
    label: string
    /**
     * What Pliant reads from a column. `type` and `unit` are set on the
     * columns Pliant computes, with the type and unit of the values. An
     * aggregated column also shows its total in the footer. A derived
     * column has `derived` and may have the `format` its op gave, which the
     * data table shows its values by. `filterValue` is the schema of the
     * values a column's own `filterFn` reads.
     */
    pliant?: {
      type?: string | undefined
      unit?: string | undefined
      format?: PliantDataTableFormat | undefined
      derived?: boolean | undefined
      filterValue?:
        | {
            readonly "~standard": {
              readonly validate: (value: unknown) => unknown
            }
          }
        | undefined
    }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
