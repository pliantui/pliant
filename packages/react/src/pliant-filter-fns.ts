import type { Row, RowData, TableFeatures } from "@tanstack/react-table"

import { filterSchema } from "@pliantui/contract"
import type { FilterValue } from "@pliantui/core"

type Operator = FilterValue["operator"]

type Scalar = string | number | boolean

/** A value as a `FilterValue`, when it is one. */
export function filterValueOf(value: unknown): FilterValue | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined
  }
  const parsed = filterSchema.safeParse({ ...value, field: "value" })
  if (!parsed.success) {
    return undefined
  }
  const { field, ...filter } = parsed.data
  return field === "value" ? filter : undefined
}

/**
 * A raw filter value, as TanStack's own filter UIs set it, as a
 * `FilterValue`: text is `contains`, a number or boolean is `eq`, two
 * numbers are `between`, and other lists of scalars are `in`.
 */
export function rawFilterValueOf(value: unknown): FilterValue | undefined {
  const filter = filterValueOf(value)
  if (filter) {
    return filter
  }
  const candidate =
    typeof value === "string"
      ? { operator: "contains", value }
      : typeof value === "number" || typeof value === "boolean"
        ? { operator: "eq", value }
        : Array.isArray(value) &&
            value.length === 2 &&
            value.every((item) => typeof item === "number")
          ? { operator: "between", value }
          : Array.isArray(value)
            ? { operator: "in", value }
            : undefined
  return filterValueOf(candidate)
}

// Dates compare by time, with text read as a date; other values compare
// only with values of their own type.
function compare(cell: unknown, value: Scalar): number | undefined {
  const left = cell instanceof Date ? cell.getTime() : cell
  const right =
    cell instanceof Date && typeof value === "string"
      ? Date.parse(value)
      : value
  if (typeof left !== typeof right || Number.isNaN(left)) {
    return undefined
  }
  if (typeof left === "number" && typeof right === "number") {
    return Number.isNaN(right) ? undefined : left - right
  }
  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0
  }
  return left === right ? 0 : undefined
}

function text(cell: unknown) {
  return typeof cell === "string" || typeof cell === "number"
    ? String(cell).toLowerCase()
    : undefined
}

/**
 * Whether a cell value passes a filter. A missing value (`null` or
 * `undefined`) passes only `isNull`, as in SQL, so `neq` doesn't keep it.
 * Text operators match case-insensitively. `custom` filters belong to the
 * column's own `filterFn`, so every value passes here.
 */
export function matchesFilter(cell: unknown, filter: FilterValue): boolean {
  if (filter.operator === "isNull") {
    return cell === null || cell === undefined
  }
  if (filter.operator === "custom") {
    return true
  }
  if (cell === null || cell === undefined) {
    return false
  }
  switch (filter.operator) {
    case "eq":
      return compare(cell, filter.value) === 0
    case "neq":
      return compare(cell, filter.value) !== 0
    case "in":
      return filter.value.some((value) => compare(cell, value) === 0)
    case "contains":
      return text(cell)?.includes(String(filter.value).toLowerCase()) ?? false
    case "startsWith":
      return text(cell)?.startsWith(String(filter.value).toLowerCase()) ?? false
    case "gt":
      return (compare(cell, filter.value) ?? Number.NaN) > 0
    case "gte":
      return (compare(cell, filter.value) ?? Number.NaN) >= 0
    case "lt":
      return (compare(cell, filter.value) ?? Number.NaN) < 0
    case "lte":
      return (compare(cell, filter.value) ?? Number.NaN) <= 0
    case "between":
      return (
        (compare(cell, filter.value[0]) ?? Number.NaN) >= 0 &&
        (compare(cell, filter.value[1]) ?? Number.NaN) <= 0
      )
  }
}

interface PliantFilterFn {
  <TFeatures extends TableFeatures, TData extends RowData>(
    row: Row<TFeatures, TData>,
    columnId: string,
    filterValue: unknown
  ): boolean
  resolveFilterValue: (filterValue: unknown) => FilterValue | undefined
}

// TanStack resolves a filter value once per filter, then calls the filter
// function once per row, so the parsed values are remembered.
const resolved = new WeakSet<object>()

function isResolved(value: unknown): value is FilterValue {
  return typeof value === "object" && value !== null && resolved.has(value)
}

function resolveFilterValue(filterValue: unknown) {
  const value = rawFilterValueOf(filterValue)
  if (value) {
    resolved.add(value)
  }
  return value
}

function filterFnOf(operator?: Operator): PliantFilterFn {
  function filter<TFeatures extends TableFeatures, TData extends RowData>(
    row: Row<TFeatures, TData>,
    columnId: string,
    filterValue: unknown
  ) {
    const value = isResolved(filterValue)
      ? filterValue
      : rawFilterValueOf(filterValue)
    return value === undefined ||
      (operator !== undefined && value.operator !== operator)
      ? true
      : matchesFilter(row.getValue(columnId), value)
  }
  return Object.assign(filter, { resolveFilterValue })
}

/**
 * The filter function Pliant gives columns without their own `filterFn`. It
 * reads a `FilterValue`, or a raw value as `rawFilterValueOf` maps it.
 */
export const pliantFilterFn = filterFnOf()

/**
 * One TanStack filter function per operator, registered as `pliant:eq`,
 * `pliant:between`, …, each reading a `FilterValue` with its operator.
 * `custom` has none: a column with its own `filterFn` reads its own values.
 */
export const pliantFilterFns = {
  "pliant:eq": filterFnOf("eq"),
  "pliant:neq": filterFnOf("neq"),
  "pliant:in": filterFnOf("in"),
  "pliant:contains": filterFnOf("contains"),
  "pliant:startsWith": filterFnOf("startsWith"),
  "pliant:gt": filterFnOf("gt"),
  "pliant:gte": filterFnOf("gte"),
  "pliant:lt": filterFnOf("lt"),
  "pliant:lte": filterFnOf("lte"),
  "pliant:between": filterFnOf("between"),
  "pliant:isNull": filterFnOf("isNull"),
}
