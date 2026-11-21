/**
 * How a derived column's values are shown, as an `addDerived` op's `format`
 * gives it.
 */
export type PliantDataTableFormat =
  | {
      type: "number"
      decimals?: number | undefined
      notation?: "standard" | "compact" | undefined
      unit?: string | undefined
    }
  | { type: "percent"; decimals?: number | undefined }
  | {
      type: "currency"
      currency?: string | undefined
      display?: "symbol" | "narrowSymbol" | "code" | "name" | undefined
      decimals?: number | undefined
    }
  | {
      type: "date"
      style: "short" | "medium" | "long" | "full" | "relative"
      time?: boolean | undefined
    }

const relativeUnits = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
] as const

function formatRelative(date: Date, locale: string | undefined) {
  const seconds = (date.getTime() - Date.now()) / 1000
  const [unit, size] = relativeUnits.find(
    ([, size]) => Math.abs(seconds) >= size
  ) ?? ["second", 1]
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit
  )
}

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "boolean"
    ? String(value)
    : "—"
}

/**
 * Formats a derived column's value by its `format`: a number, percent (the
 * value is a fraction), currency (in the format's currency, else the value's
 * `unit`) or date. A date is the text a derived column holds, `YYYY-MM-DD`
 * or an ISO 8601 date-time in UTC; a date without a time shows as the
 * calendar day it names, and a date-time in `timeZone`, by default the
 * viewer's. Text and booleans show as they are, and anything else, such as a
 * missing value, as a dash.
 */
export function formatPliantValue(
  value: unknown,
  format: PliantDataTableFormat,
  unit?: string,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {}
) {
  if (value === undefined || value === null) {
    return "—"
  }
  if (format.type === "date") {
    const date = new Date(typeof value === "string" ? value : Number.NaN)
    if (Number.isNaN(date.getTime())) {
      return textOf(value)
    }
    if (format.style === "relative") {
      return formatRelative(date, locale)
    }
    const dateOnly = typeof value === "string" && value.length === 10
    return new Intl.DateTimeFormat(locale, {
      dateStyle: format.style,
      ...(format.time && !dateOnly && { timeStyle: "short" }),
      timeZone: dateOnly ? "UTC" : timeZone,
    }).format(date)
  }
  if (typeof value !== "number") {
    return textOf(value)
  }
  try {
    return formatNumber(value, format, unit, locale)
  } catch (error) {
    // `Intl` rejects a unit it doesn't know.
    if (error instanceof RangeError) {
      return String(value)
    }
    throw error
  }
}

function formatNumber(
  value: number,
  format: Exclude<PliantDataTableFormat, { type: "date" }>,
  unit: string | undefined,
  locale: string | undefined
) {
  switch (format.type) {
    case "percent":
      return new Intl.NumberFormat(locale, {
        style: "percent",
        ...(format.decimals !== undefined && {
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals,
        }),
      }).format(value)
    case "currency": {
      const currency = format.currency ?? unit
      return new Intl.NumberFormat(locale, {
        ...(currency
          ? {
              style: "currency",
              currency,
              currencyDisplay: format.display ?? "symbol",
            }
          : {}),
        ...(format.decimals !== undefined && {
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals,
        }),
      }).format(value)
    }
    case "number":
      return new Intl.NumberFormat(locale, {
        notation: format.notation ?? "standard",
        ...(format.unit && { style: "unit", unit: format.unit }),
        ...(format.decimals !== undefined && {
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals,
        }),
      }).format(value)
  }
}
