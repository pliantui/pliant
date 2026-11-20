import type { FunctionName } from "@pliantui/contract"

import { inDayRange, inInstantRange, type Value } from "./read-value"
import type { Call, RowFunction } from "./row-function"
import { civil, dayMs, dayOf } from "./time-zone"

// Arguments are type-checked against the function catalog before a call:
// a date is a day number, a datetime an instant, and units are constants.
function dayAt(args: readonly Value[], index: number, { types, zone }: Call) {
  const value = args[index] as number
  return types[index] === "datetime"
    ? Math.floor(zone.wallClock(value) / dayMs)
    : value
}

function months(start: number, end: number): number {
  if (end < start) {
    return -months(end, start)
  }
  const [startYear, startMonth, startDay] = civil(start)
  const [endYear, endMonth, endDay] = civil(end)
  const count = (endYear - startYear) * 12 + endMonth - startMonth
  const [, , lastDay] = civil(dayOf(endYear, endMonth + 1, 0))
  return count - (endDay < Math.min(startDay, lastDay) ? 1 : 0)
}

function dateDiff(start: number, end: number, unit: Value) {
  switch (unit) {
    case "days":
      return end - start
    case "weeks":
      return Math.trunc((end - start) / 7)
    case "months":
      return months(start, end)
    default:
      return Math.trunc(months(start, end) / 12)
  }
}

/** The ISO 8601 week number, from the Thursday of the date's week. */
function isoWeek(day: number) {
  const [, , , weekday] = civil(day)
  const thursday = day + 3 - ((weekday + 6) % 7)
  const [year] = civil(thursday)
  return Math.floor((thursday - dayOf(year, 1, 1)) / 7) + 1
}

function datePart(day: number, part: Value) {
  const [year, month, date, weekday] = civil(day)
  switch (part) {
    case "year":
      return year
    case "quarter":
      return Math.ceil(month / 3)
    case "month":
      return month
    case "week":
      return isoWeek(day)
    case "weekday":
      return weekday || 7
    default:
      return date
  }
}

function dateTrunc(day: number, unit: Value) {
  const [year, month, , weekday] = civil(day)
  switch (unit) {
    case "week":
      return day - ((weekday + 6) % 7)
    case "month":
      return dayOf(year, month, 1)
    case "quarter":
      return dayOf(year, month - ((month - 1) % 3), 1)
    case "year":
      return dayOf(year, 1, 1)
    default:
      return day
  }
}

function addDays(args: readonly Value[], { types, zone }: Call) {
  const [date, days] = args as readonly number[]
  if (date === undefined || days === undefined) {
    return null
  }
  if (types[0] !== "datetime") {
    return inDayRange(date + days)
  }
  const moved = zone.wallClock(date) + days * dayMs
  return inInstantRange(moved) === null
    ? null
    : inInstantRange(zone.instant(moved))
}

/** The built-in date functions, by name. */
export const dateFunctions: Partial<Record<FunctionName, RowFunction>> = {
  dateDiff: (args, call) =>
    dateDiff(dayAt(args, 0, call), dayAt(args, 1, call), args[2] ?? null),
  datePart: (args, call) => datePart(dayAt(args, 0, call), args[1] ?? null),
  dateTrunc: (args, call) => dateTrunc(dayAt(args, 0, call), args[1] ?? null),
  addDays,
  today: (_, { today }) => today(),
  age: (args, call) => dateDiff(dayAt(args, 0, call), call.today(), "years"),
}
