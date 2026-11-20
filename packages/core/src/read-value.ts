import type { ExpressionField } from "./check-expression"
import { dayMs, type TimeZone } from "./time-zone"

/**
 * A value as expressions compute it: a date is a day counted from
 * 1970-01-01 and a datetime is milliseconds since the epoch.
 */
export type Value = string | number | boolean | null

// A JavaScript Date holds 100,000,000 days either side of 1970-01-01. Two
// days are kept in reserve so that converting between time zones near the
// ends stays within that range.
const maxDay = 1e8 - 2

const isoPattern =
  /^(\d{4}-\d\d-\d\d)(?:(T\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/

/** A number that is finite, with -0 as 0, or null. */
export function finite(value: number): number | null {
  return Number.isFinite(value) ? value + 0 : null
}

export function inDayRange(day: number): number | null {
  return Math.abs(day) <= maxDay ? day : null
}

export function inInstantRange(instant: number): number | null {
  return Math.abs(instant) <= maxDay * dayMs ? instant : null
}

/**
 * Reads a date or datetime from text: a date as YYYY-MM-DD, or a date-time
 * as ISO 8601 with seconds, any fraction of a second (cut to milliseconds)
 * and an optional offset. Text without an offset is a wall-clock time in the
 * zone, and a date read as a datetime is the start of that day there. A
 * date-time with an offset read as a date is its date in the zone.
 */
export function readTime(
  value: unknown,
  type: "date" | "datetime",
  zone: TimeZone
): number | null {
  const [, date, time = "T00:00:00", fraction = "", offset] =
    (typeof value === "string" ? isoPattern.exec(value) : null) ?? []
  const iso = `${date ?? ""}${time}.${fraction.padEnd(3, "0").slice(0, 3)}Z`
  const local = Date.parse(iso)
  if (Number.isNaN(local) || new Date(local).toISOString() !== iso) {
    return null
  }
  // Parsing the offset at the epoch gives minus the offset.
  const shift =
    offset === undefined
      ? undefined
      : Date.parse(`1970-01-01T00:00:00${offset}`)
  if (type === "datetime") {
    return shift === undefined ? zone.instant(local) : local + shift
  }
  return Math.floor(
    (shift === undefined ? local : zone.wallClock(local + shift)) / dayMs
  )
}

/**
 * Reads a row's value of a field. A value that doesn't fit the field's type,
 * such as text in a number field or a fraction in an integer field, is null,
 * as a NaN or infinite number is.
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
