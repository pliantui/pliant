import {
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  type TableFeatures,
} from "@tanstack/react-table"

import { pliantFilterFns } from "./pliant-filter-fns"

/**
 * The developer's features with the ones Pliant's ops need added: column
 * ordering, sizing, pinning, visibility and filtering, grouping, aggregation,
 * expanding, sorting and pagination, with the filtered, grouped, expanded and
 * sorted row models when the developer has none (they change nothing until
 * an op sets their state),
 * the sort functions TanStack's `auto` picks from (`basic` for numbers,
 * `datetime` for dates, `alphanumeric` and `text` for text, which sort
 * case-insensitively), and the `pliant:*` filter functions. The
 * paginated row model isn't added: it would page a table that shows every
 * row. The developer's own entries win.
 */
export function withPliantFeatures(features: TableFeatures): TableFeatures {
  return {
    columnFilteringFeature,
    columnGroupingFeature,
    columnOrderingFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnVisibilityFeature,
    rowAggregationFeature,
    rowExpandingFeature,
    rowPaginationFeature,
    rowSortingFeature,
    ...features,
    expandedRowModel: features.expandedRowModel ?? createExpandedRowModel(),
    filteredRowModel: features.filteredRowModel ?? createFilteredRowModel(),
    groupedRowModel: features.groupedRowModel ?? createGroupedRowModel(),
    sortedRowModel: features.sortedRowModel ?? createSortedRowModel(),
    filterFns: { ...pliantFilterFns, ...features.filterFns },
    sortFns: {
      alphanumeric: sortFn_alphanumeric,
      basic: sortFn_basic,
      datetime: sortFn_datetime,
      text: sortFn_text,
      ...features.sortFns,
    },
  }
}
