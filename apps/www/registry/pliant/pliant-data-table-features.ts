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
     * Set on the columns Pliant aggregates, with the type and unit of the
     * values. The data table shows an aggregate's total in the footer.
     */
    pliant?: { type: string; unit?: string | undefined }
  }
}
/* eslint-enable @typescript-eslint/no-unused-vars */
