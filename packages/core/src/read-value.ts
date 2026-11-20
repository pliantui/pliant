import type { ExpressionField } from "./check-expression"
import { dayMs, type TimeZone } from "./time-zone"

/**
 * A value as expressions compute it: a date is a day counted from
 * 1970-01-01 and a datetime is milliseconds since the epoch.
 */
export type Value = string | number | boolean | null

// Dates and datetimes are kept to the years 0000 to 9999 in UTC, which ISO
// 8601 writes with four digits.
const firstDay = -719_528
const lastDay = 2_932_896

const isoPattern =
  /^(\d{4}-\d\d-\d\d)(?:(T\d\d:\d\d:\d\d)(?:\.(\d+))?(?:([zZ])|([+-])([01]\d|2[0-3])(?::?([0-5]\d))?)?)?$/

/** A number that is finite, with -0 as 0, or null. */
export function finite(value: number): number | null {
  return Number.isFinite(value) ? value + 0 : null
}

/** A day or an instant within the years 0000 to 9999, or null. */
export function inRange(value: number, type: "date" | "datetime") {
  const scale = type === "date" ? 1 : dayMs
  return value >= firstDay * scale && value < (lastDay + 1) * scale
    ? value
    : null
}

// Reads the time of a Date from this or another realm through its internal
// slot, which, unlike its `toString` tag, another object can't imitate.
function timeOf(value: unknown) {
  try {
    return typeof value === "object" && value !== null
      ? Date.prototype.getTime.call(value)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads a date or datetime. Text is a date as YYYY-MM-DD, or a date-time as
 * ISO 8601 with seconds, any fraction of a second (cut to milliseconds) and
 * an optional offset: `Z`, `z`, `±hh:mm`, `±hhmm` or `±hh`. Text without an
 * offset is a wall-clock time in the zone, and a date read as a datetime is
 * the start of that day there. A date-time with an offset read as a date is
 * its date in the zone. A `Date` read as a datetime is its instant, and read
 * as a date is its UTC calendar date, which is how database drivers return
 * date columns. Anything else, an epoch number included, is null.
 */
export function readTime(
  value: unknown,
  type: "date" | "datetime",
  zone: TimeZone
): number | null {
  const instant = timeOf(value)
  if (instant !== undefined) {
    return inRange(
      type === "date" ? Math.floor(instant / dayMs) : instant,
      type
    )
  }
  const [, date, time = "T00:00:00", fraction = "", z, sign, hours, minutes] =
    (typeof value === "string" ? isoPattern.exec(value) : null) ?? []
  const iso = `${date ?? ""}${time}.${fraction.padEnd(3, "0").slice(0, 3)}Z`
  const local = Date.parse(iso)
  if (Number.isNaN(local) || new Date(local).toISOString() !== iso) {
    return null
  }
  const shift =
    sign === undefined
      ? z === undefined
        ? undefined
        : 0
      : (sign === "-" ? 60_000 : -60_000) *
        (Number(hours) * 60 + Number(minutes ?? 0))
  if (type === "datetime") {
    return inRange(
      shift === undefined ? zone.instant(local) : local + shift,
      type
    )
  }
  return inRange(
    Math.floor(
      (shift === undefined ? local : zone.wallClock(local + shift)) / dayMs
    ),
    type
  )
}

/**
 * Reads a row's value of a field. Numbers are JavaScript numbers, strings
 * are strings and booleans are booleans; dates are read by `readTime`. A
 * value that doesn't fit the field's type is null: text in a number field, a
 * fraction in an integer field, a NaN or infinite number, or a `bigint`,
 * decimal object or numeric string, which a caller converts first.
 */
export function readField(
  { type }: ExpressionField,
  value: unknown,
  zone: TimeZone
): Value {
  switch (type) {
    case "date":
    case "datetime":
      return readTime(value, type, zone)
    case "boolean":
      return typeof value === "boolean" ? value : null
    case "number":
    case "integer":
    case "currency":
    case "percent":
      return typeof value === "number" &&
        (type !== "integer" || Number.isInteger(value))
        ? finite(value)
        : null
    default:
      return typeof value === "string" ? value : null
  }
}
