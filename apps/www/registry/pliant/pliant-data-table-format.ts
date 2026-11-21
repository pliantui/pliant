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

type NumberFormat = Exclude<PliantDataTableFormat, { type: "date" }>

const relativeUnits = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
] as const

const dayInSeconds = 24 * 60 * 60

// A date without a time is a calendar day, so it is as far from today as
// the days between them, in `timeZone`, not the hours.
function formatRelative(
  date: Date,
  dateOnly: boolean,
  {
    locale,
    timeZone,
  }: { locale?: string | undefined; timeZone?: string | undefined }
) {
  const now = dateOnly
    ? Date.parse(
        new Intl.DateTimeFormat("en-CA", { timeZone }).format(Date.now())
      )
    : Date.now()
  const seconds = (date.getTime() - now) / 1000
  const [unit, size] =
    relativeUnits.find(
      ([, size]) =>
        Math.abs(seconds) >= size && (!dateOnly || size >= dayInSeconds)
    ) ??
    (dateOnly ? (["day", dayInSeconds] as const) : (["second", 1] as const))
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    Math.round(seconds / size),
    unit
  )
}

// With no format, a number is shown by its unit: a percent as a percentage,
// a currency in its own style, and anything else as a plain number.
function formatOfUnit(unit: string | undefined): NumberFormat {
  return unit === "percent"
    ? { type: "percent" }
    : unit && /^[A-Z]{3}$/.test(unit)
      ? { type: "currency" }
      : { type: "number" }
}

function textOf(value: unknown) {
  return typeof value === "string" || typeof value === "boolean"
    ? String(value)
    : "—"
}

/**
 * Formats a derived column's value by its `format`: a number, percent (the
 * value is a fraction), currency (in the format's currency, else the value's
 * `unit`) or date. Without a `format`, a number is shown by its `unit`: a
 * percent unit as a percentage, a currency code as a currency rounded to its
 * minor units, and any other as a plain number. A date is the text a derived column holds, `YYYY-MM-DD`
 * or an ISO 8601 date-time in UTC; a date without a time shows as the
 * calendar day it names, and a date-time in `timeZone`, by default the
 * viewer's. Text and booleans show as they are, and anything else, such as a
 * missing value, as a dash.
 */
export function formatPliantValue(
  value: unknown,
  format: PliantDataTableFormat | undefined,
  unit?: string,
  { locale, timeZone }: { locale?: string; timeZone?: string } = {}
) {
  if (value === undefined || value === null) {
    return "—"
  }
  if (format?.type === "date") {
    const date = new Date(typeof value === "string" ? value : Number.NaN)
    if (Number.isNaN(date.getTime())) {
      return textOf(value)
    }
    const dateOnly = typeof value === "string" && value.length === 10
    if (format.style === "relative") {
      return formatRelative(date, dateOnly, { locale, timeZone })
    }
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
    return formatNumber(value, format ?? formatOfUnit(unit), unit, locale)
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
  format: NumberFormat,
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
