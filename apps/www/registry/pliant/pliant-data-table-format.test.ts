import { afterEach, describe, expect, it, vi } from "vitest"

import { formatPliantValue } from "./pliant-data-table-format"

const locale = { locale: "en-US", timeZone: "UTC" }

afterEach(() => {
  vi.useRealTimers()
})

describe("formatPliantValue", () => {
  it("shows a missing value as a dash", () => {
    expect(formatPliantValue(undefined, { type: "percent" })).toBe("—")
    expect(formatPliantValue(null, { type: "number" })).toBe("—")
  })

  it("rounds numbers to the decimals, in compact notation if asked", () => {
    expect(
      formatPliantValue(1234.567, { type: "number", decimals: 1 }, "", locale)
    ).toBe("1,234.6")
    expect(
      formatPliantValue(
        1_500_000,
        { type: "number", notation: "compact" },
        undefined,
        locale
      )
    ).toBe("1.5M")
    expect(
      formatPliantValue(
        12,
        { type: "number", unit: "kilometer", decimals: 0 },
        undefined,
        locale
      )
    ).toBe("12 km")
  })

  it("shows a unit Intl doesn't know as the plain value", () => {
    expect(
      formatPliantValue(
        12,
        { type: "number", unit: "parsec" },
        undefined,
        locale
      )
    ).toBe("12")
  })

  it("shows a percent from a fraction", () => {
    expect(
      formatPliantValue(0.256, { type: "percent" }, undefined, locale)
    ).toBe("26%")
    expect(
      formatPliantValue(
        0.256,
        { type: "percent", decimals: 1 },
        undefined,
        locale
      )
    ).toBe("25.6%")
  })

  it("shows a currency in the format's currency, else the value's unit", () => {
    expect(
      formatPliantValue(
        1234.5,
        { type: "currency", currency: "EUR" },
        "USD",
        locale
      )
    ).toBe("€1,234.50")
    expect(
      formatPliantValue(
        1234.5,
        { type: "currency", decimals: 0 },
        "USD",
        locale
      )
    ).toBe("$1,235")
    expect(
      formatPliantValue(
        5,
        { type: "currency", currency: "USD", display: "code" },
        undefined,
        locale
      )
    ).toBe("USD\u00a05.00")
    expect(
      formatPliantValue(1234.5, { type: "currency" }, undefined, locale)
    ).toBe("1,234.5")
  })

  it("shows a date as the calendar day it names, in any time zone", () => {
    const format = { type: "date", style: "medium" } as const
    expect(
      formatPliantValue("2026-03-10", format, undefined, {
        locale: "en-US",
        timeZone: "Pacific/Kiritimati",
      })
    ).toBe("Mar 10, 2026")
  })

  it("shows a date-time in the time zone, with its time if asked", () => {
    const value = "2026-03-10T23:30:00.000Z"
    expect(
      formatPliantValue(value, { type: "date", style: "short" }, undefined, {
        locale: "en-US",
        timeZone: "Pacific/Kiritimati",
      })
    ).toBe("3/11/26")
    expect(
      formatPliantValue(
        value,
        { type: "date", style: "short", time: true },
        undefined,
        locale
      )
    ).toBe("3/10/26, 11:30 PM")
  })

  it("shows a relative date by the largest unit that fits", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"))
    const format = { type: "date", style: "relative" } as const
    const show = (value: string) =>
      formatPliantValue(value, format, undefined, locale)
    expect(show("2026-03-09T12:00:00.000Z")).toBe("yesterday")
    expect(show("2026-03-13T12:00:00.000Z")).toBe("in 3 days")
    expect(show("2026-03-10T09:00:00.000Z")).toBe("3 hours ago")
    expect(show("2025-03-10T12:00:00.000Z")).toBe("last year")
  })

  it("shows what isn't a number or a date as its text", () => {
    expect(formatPliantValue("n/a", { type: "number" })).toBe("n/a")
    expect(
      formatPliantValue("not a date", { type: "date", style: "long" })
    ).toBe("not a date")
    expect(formatPliantValue(true, { type: "percent" })).toBe("true")
  })
})
