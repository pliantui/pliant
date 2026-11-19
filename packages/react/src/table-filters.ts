import type { FilterValue } from "@pliantui/core"

import { filterValueOf, rawFilterValueOf } from "./pliant-filter-fns"
import { isSameState } from "./same-state"
import { customValueOf, type TableColumn } from "./table-columns"

export interface ColumnFilter {
  readonly id: string
  readonly value: unknown
}

/** A value the developer's filter UI set, and the filter it maps to, if any. */
export interface RawFilter {
  readonly entry: ColumnFilter
  readonly value: FilterValue | undefined
}

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

/**
 * The filters as TanStack sees them:
 * - the developer's own value, for a filter it maps to;
 * - the bare value of a `custom` filter, for a column with its own
 *   `filterFn`, which reads only those; its other filters are `dropped`;
 * - Pliant's `FilterValue` otherwise;
 * - then the raw values no op holds.
 */
export function presentFilters(
  filters: readonly ColumnFilter[],
  raws: ReadonlyMap<string, RawFilter>,
  columnOf: (id: string) => TableColumn | undefined
) {
  const shown: ColumnFilter[] = []
  const dropped: ColumnFilter[] = []
  for (const filter of filters) {
    const raw = raws.get(filter.id)
    if (raw?.value && isSameState(raw.value, filter.value)) {
      shown.push(raw.entry)
      continue
    }
    const value = filterValueOf(filter.value)
    if (!value || !columnOf(filter.id)?.ownFilter) {
      shown.push(filter)
    } else if (value.operator === "custom") {
      shown.push({ id: filter.id, value: value.value })
    } else {
      dropped.push(filter)
    }
  }
  for (const { entry, value } of raws.values()) {
    if (value === undefined && !filters.some(({ id }) => id === entry.id)) {
      shown.push(entry)
    }
  }
  return { shown, dropped }
}

/**
 * The filters to save for the filters TanStack reported: unchanged entries
 * keep the filter Pliant holds, and changed raw values become filters when
 * they map to one, or are kept in `raws` when they don't, such as any value
 * for a column whose id ops can't name (`local`).
 */
export function filtersToSave(
  held: readonly ColumnFilter[],
  shown: readonly ColumnFilter[],
  reported: unknown,
  raws: ReadonlyMap<string, RawFilter>,
  columnOf: (id: string) => TableColumn | undefined,
  local: (id: string) => boolean
) {
  const before = new Map(shown.map(({ id, value }) => [id, value]))
  const holding = new Map(held.map(({ id, value }) => [id, value]))
  const filters: ColumnFilter[] = []
  const nextRaws = new Map<string, RawFilter>()
  for (const filter of Array.isArray(reported) ? reported : []) {
    const id = read(filter, "id")
    const raw = read(filter, "value")
    if (typeof id !== "string") {
      continue
    }
    if (before.has(id) && isSameState(before.get(id), raw)) {
      if (holding.has(id)) {
        filters.push({ id, value: holding.get(id) })
      }
      const kept = raws.get(id)
      if (kept) {
        nextRaws.set(id, kept)
      }
      continue
    }
    const column = columnOf(id)
    const custom = column?.ownFilter ? customValueOf(column, raw) : undefined
    const value = local(id)
      ? undefined
      : column?.ownFilter
        ? (filterValueOf(raw) ??
          (custom &&
            filterValueOf({ operator: "custom", value: custom.value })))
        : rawFilterValueOf(raw)
    if (value) {
      filters.push({ id, value })
    }
    nextRaws.set(id, { entry: { id, value: raw }, value })
  }
  for (const [id, value] of holding) {
    if (!before.has(id) && !filters.some((filter) => filter.id === id)) {
      filters.push({ id, value })
    }
  }
  return { filters, raws: nextRaws }
}
