import type { Filter } from "@pliantui/contract"

import type { DatasetFieldType } from "./dataset-field"

type Scalar = string | number | boolean

type Comparison = "eq" | "neq" | "gt" | "gte" | "lt" | "lte"

/** How a filter reaches the query being built. */
export interface FilterContext {
  /** The field's column, quoted. */
  readonly column: string
  readonly type: DatasetFieldType
  /** Adds a parameter and returns its placeholder, such as `$3`. */
  readonly param: (value: unknown) => string
  /** The placeholder of the dataset's time zone. */
  readonly timeZone: () => string
}

const operators: Record<Comparison, string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
}

const textTypes = new Set<DatasetFieldType>([
  "string",
  "text",
  "enum",
  "id",
  "url",
  "email",
])

const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/
const dateTime =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?$/

function isDay(value: string) {
  const match = dateOnly.exec(value)
  if (!match) {
    return false
  }
  const [year = 0, month = 0, day = 0] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(2000, month - 1, day))
  date.setUTCFullYear(year)
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isInstant(value: string) {
  return dateTime.test(value) && !Number.isNaN(Date.parse(value))
}

function fits(type: DatasetFieldType, value: Scalar) {
  switch (type) {
    case "number":
    case "currency":
    case "percent":
      return typeof value === "number"
    case "integer":
      return Number.isSafeInteger(value)
    case "boolean":
      return typeof value === "boolean"
    case "date":
    case "datetime":
      return typeof value === "string" && (isDay(value) || isInstant(value))
    default:
      return typeof value === "string"
  }
}

function allows(type: DatasetFieldType, operator: Filter["operator"]) {
  if (textTypes.has(type) || operator === "isNull" || operator === "in") {
    return true
  }
  if (operator === "contains" || operator === "startsWith") {
    return false
  }
  return type !== "boolean" || operator === "eq" || operator === "neq"
}

// Enum columns may be Postgres enums, which compare by their declared order,
// and id columns may be uuids, so both are read as text.
export function textOf(column: string, type: DatasetFieldType) {
  return type === "enum" || type === "id" ? `${column}::text` : column
}

/**
 * A date filter value against a date or datetime column. A day (an ISO date
 * without a time) covers that calendar day in the dataset's time zone, and
 * an instant without an offset is read in that zone too, so a day equals
 * every instant in it.
 */
function compareTime(
  { column, type, param, timeZone }: FilterContext,
  operator: Comparison,
  value: string
) {
  const placeholder = param(value)
  const zoned = !isDay(value) && dateTime.exec(value)?.[1] !== undefined
  const instant = () =>
    zoned
      ? `${placeholder}::timestamptz`
      : `(${placeholder}::timestamp AT TIME ZONE ${timeZone()})`
  if (type === "date") {
    const day = isDay(value)
      ? `${placeholder}::date`
      : `(${instant()} AT TIME ZONE ${timeZone()})::date`
    return `${column} ${operators[operator]} ${day}`
  }
  if (!isDay(value)) {
    return `${column} ${operators[operator]} ${instant()}`
  }
  const start = `(${placeholder}::date::timestamp AT TIME ZONE ${timeZone()})`
  const end = `((${placeholder}::date + 1)::timestamp AT TIME ZONE ${timeZone()})`
  switch (operator) {
    case "eq":
      return `(${column} >= ${start} AND ${column} < ${end})`
    case "neq":
      return `(${column} < ${start} OR ${column} >= ${end})`
    case "gt":
      return `${column} >= ${end}`
    case "gte":
      return `${column} >= ${start}`
    case "lt":
      return `${column} < ${start}`
    case "lte":
      return `${column} < ${end}`
  }
}

function compare(context: FilterContext, operator: Comparison, value: Scalar) {
  const { column, type, param } = context
  if (type === "date" || type === "datetime") {
    return compareTime(context, operator, String(value))
  }
  if (!textTypes.has(type)) {
    return `${column} ${operators[operator]} ${param(value)}`
  }
  // Equality uses the column as it is, so its indexes apply; order compares
  // by code point, as the client does, whatever the column's collation.
  const text = textOf(column, type)
  const ordered =
    operator === "eq" || operator === "neq" ? text : `${text} COLLATE "C"`
  return `${ordered} ${operators[operator]} ${param(value)}`
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

/**
 * Compiles one filter to a SQL condition, or returns why it can't: an
 * operator the field's type doesn't support, or a value that doesn't fit
 * the field's type. A row without a value passes only `isNull`.
 */
export function compileFilter(
  filter: Filter,
  context: FilterContext
): string | { readonly problem: string } {
  const { column, type, param } = context
  if (!allows(type, filter.operator)) {
    return { problem: `a ${type} field can't use ${filter.operator}` }
  }
  if (filter.operator === "isNull") {
    return `${column} IS NULL`
  }
  if (filter.operator === "custom") {
    return { problem: "custom filters can't be compiled" }
  }
  const values: readonly Scalar[] = [filter.value].flat()
  if (!values.every((value) => fits(type, value))) {
    return { problem: `a value doesn't fit a ${type} field` }
  }
  switch (filter.operator) {
    case "contains":
    case "startsWith": {
      const text = escapeLike(String(filter.value))
      const pattern = filter.operator === "contains" ? `%${text}%` : `${text}%`
      return `lower(${textOf(column, type)}) LIKE lower(${param(pattern)}) ESCAPE '\\'`
    }
    case "in":
      return type === "date" || type === "datetime"
        ? `(${filter.value.map((value) => compare(context, "eq", value)).join(" OR ")})`
        : `${textOf(column, type)} = ANY(${param(filter.value)})`
    case "between":
      return `(${compare(context, "gte", filter.value[0])} AND ${compare(context, "lte", filter.value[1])})`
    default:
      return compare(context, filter.operator, filter.value)
  }
}
