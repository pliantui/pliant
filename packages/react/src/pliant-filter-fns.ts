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

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === ""
}

function numberOf(value: unknown) {
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const number = Number(value)
    return Number.isNaN(number) ? undefined : number
  }
  return undefined
}

/**
 * Whether TanStack removes a raw filter value instead of setting it, as its
 * range filters do: `undefined`, `null`, `""`, and a pair with both ends
 * empty, such as `[]` or `[undefined, ""]`. A `FilterValue` never is.
 */
export function isEmptyFilterValue(value: unknown) {
  return (
    isEmpty(value) ||
    (Array.isArray(value) && isEmpty(value[0]) && isEmpty(value[1]))
  )
}

// A `[min, max]` pair from a range input: numbers or numeric text, with an
// empty end left open, as TanStack's `inNumberRange` reads it.
function rangeOf(value: unknown): FilterValue | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((end) => isEmpty(end) || numberOf(end) !== undefined)
  ) {
    return undefined
  }
  const [min, max] = value.map(numberOf)
  if (min !== undefined && max !== undefined) {
    return {
      operator: "between",
      value: min <= max ? [min, max] : [max, min],
    }
  }
  if (min !== undefined) {
    return { operator: "gte", value: min }
  }
  return max === undefined ? undefined : { operator: "lte", value: max }
}

/**
 * A raw filter value, as TanStack's own filter UIs set it, as a
 * `FilterValue`. These are guesses at what the UI meant, made the way
 * TanStack's `auto` filter functions read values:
 * - text is `contains`, and a number or boolean is `eq`;
 * - a pair of numbers or numeric text, either end possibly empty, is a
 *   range: `between`, or `gte`/`lte` with one end open (so `[1, 5]` is a
 *   range, not a list of two values);
 * - any other list of scalars is `in`.
 */
export function rawFilterValueOf(value: unknown): FilterValue | undefined {
  const filter = filterValueOf(value) ?? rangeOf(value)
  if (filter) {
    return filter
  }
  return filterValueOf(
    typeof value === "string"
      ? { operator: "contains", value }
      : typeof value === "number" || typeof value === "boolean"
        ? { operator: "eq", value }
        : Array.isArray(value)
          ? { operator: "in", value }
          : undefined
  )
}

const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/
const dateTime = /^\d{4}-\d{2}-\d{2}T/

// Midnight in the viewer's zone, or `undefined` for a day that doesn't
// exist (`2026-02-31`). `setFullYear` keeps years before 100 as they are.
function midnight(year: number, month: number, day: number) {
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined
}

/**
 * A date as the milliseconds it covers, `[start, end)`: an instant covers
 * one, and a date without a time (`2026-03-01`) covers that calendar day in
 * the viewer's time zone. Pliant has no dataset time zone on the client
 * yet, so the viewer's zone is the one personal overlays use (spec 8.4).
 */
function spanOf(value: unknown): readonly [number, number] | undefined {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isNaN(time) ? undefined : [time, time + 1]
  }
  if (typeof value !== "string") {
    return undefined
  }
  const day = dateOnly.exec(value)
  if (day) {
    const [year = 0, month = 0, date = 0] = day.slice(1).map(Number)
    const start = midnight(year, month, date)
    if (!start) {
      return undefined
    }
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return [start.getTime(), end.getTime()]
  }
  const time = dateTime.test(value) ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? undefined : [time, time + 1]
}

/**
 * How a cell compares with a filter value: negative before it, 0 equal, or
 * positive after it, and `undefined` when they don't compare. It reads both
 * sides the same way:
 * - Dates (a `Date`, or ISO text) compare by the time they cover, so a day
 *   equals every instant in it, and with a number as milliseconds.
 * - A number compares with a number or numeric text.
 * - Text compares with text by code unit, case-sensitively, as SQL does by
 *   default, and booleans only for equality.
 */
function compare(cell: unknown, value: Scalar): number | undefined {
  const cellDate = spanOf(cell)
  const valueDate = spanOf(value)
  if (cellDate || valueDate) {
    const asSpan = (side: unknown) =>
      typeof side === "number" ? ([side, side + 1] as const) : undefined
    const left = cellDate ?? asSpan(cell)
    const right = valueDate ?? asSpan(value)
    if (!left || !right) {
      return undefined
    }
    return left[1] <= right[0] ? -1 : left[0] >= right[1] ? 1 : 0
  }
  if (typeof cell === "number" || typeof value === "number") {
    const left = numberOf(cell)
    const right = numberOf(value)
    return left === undefined || right === undefined ? undefined : left - right
  }
  if (typeof cell === "string" && typeof value === "string") {
    return cell < value ? -1 : cell > value ? 1 : 0
  }
  return typeof cell === "boolean" && cell === value ? 0 : undefined
}

// Lower-cased without the viewer's locale, so a filter matches the same
// rows for everyone, as SQL's `lower` does.
function text(cell: unknown) {
  return typeof cell === "string" || typeof cell === "number"
    ? String(cell).toLowerCase()
    : undefined
}

/**
 * Whether a cell value passes a filter.
 * - A missing value (`null` or `undefined`) passes only `isNull`, as in SQL,
 *   so `neq` and every comparison leave it out.
 * - `eq`, `neq` and `in` compare as `compare` does, case-sensitively, as SQL
 *   does by default. Values that don't compare (words with a number, for
 *   example) are never equal, so `neq` keeps them.
 * - `contains` and `startsWith` match text case-insensitively, as most
 *   search boxes do; a number matches as its digits.
 * - `gt`, `gte`, `lt`, `lte` and `between` (inclusive) keep only values that
 *   compare.
 * - `custom` filters belong to the column's own `filterFn`, so every value
 *   passes here.
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
  autoRemove: (filterValue: unknown) => boolean
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
  return Object.assign(filter, {
    resolveFilterValue,
    autoRemove: isEmptyFilterValue,
  })
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
