import {
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createGroupedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  type TableFeatures,
} from "@tanstack/react-table"

import { pliantFilterFns } from "./pliant-filter-fns"

/**
 * The developer's features with the ones Pliant's ops need added: column
 * ordering, sizing, pinning, visibility and filtering, grouping, sorting and
 * pagination, with the filtered, sorted and grouped row models when the
 * developer has none (they change nothing until an op sets their state),
 * `sortFns.basic` for numbers, and the `pliant:*` filter functions. The
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
    rowPaginationFeature,
    rowSortingFeature,
    ...features,
    filteredRowModel: features.filteredRowModel ?? createFilteredRowModel(),
    groupedRowModel: features.groupedRowModel ?? createGroupedRowModel(),
    sortedRowModel: features.sortedRowModel ?? createSortedRowModel(),
    filterFns: { ...pliantFilterFns, ...features.filterFns },
    sortFns: { basic: sortFn_basic, ...features.sortFns },
  }
}
