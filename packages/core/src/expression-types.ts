import type { FunctionDefinition } from "@pliantui/contract"

export type ValueType = Extract<FunctionDefinition["returns"], string>

/** The type the checker infers for one expression node. */
export interface Inferred {
  readonly type: ValueType | "null"
  readonly unit?: string | undefined
  /** The text of a string literal, which can also be read as a date. */
  readonly literal?: string | undefined
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const datetimePattern =
  /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/

function isCalendarDate(text: string) {
  const time = Date.parse(`${text}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(text)
}

/**
 * The type a string literal has where a date is expected: `date` for
 * YYYY-MM-DD, `datetime` for an ISO 8601 date-time with seconds, optional
 * milliseconds and an offset.
 */
export function literalType(text: string): "date" | "datetime" | undefined {
  if (datePattern.test(text)) {
    return isCalendarDate(text) ? "date" : undefined
  }
  const day = datetimePattern.exec(text)?.[1]
  return day !== undefined && isCalendarDate(day) ? "datetime" : undefined
}

/** Whether the text is written as a date or datetime, valid or not. */
export function looksLikeDate(text: string) {
  return datePattern.test(text) || datetimePattern.test(text)
}

export function unifyTypes(a: ValueType, b: ValueType): ValueType | undefined {
  if (a === b) {
    return a
  }
  const pair = [a, b]
  if (pair.includes("integer") && pair.includes("number")) {
    return "number"
  }
  if (pair.includes("date") && pair.includes("datetime")) {
    return "datetime"
  }
  return undefined
}

export function fitsTypes(type: ValueType, allowed: readonly ValueType[]) {
  return (
    allowed.includes(type) || (type === "integer" && allowed.includes("number"))
  )
}

export function describeTypes(types: readonly ValueType[]) {
  const last = types.at(-1) ?? ""
  const words =
    types.length > 1 ? `${types.slice(0, -1).join(", ")} or ${last}` : last
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`
}
