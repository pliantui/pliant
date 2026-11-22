import { describe, expect, it, vi } from "vitest"

import { orderHistoryRows, sumOrderHistory } from "./order-history"

// Lets the server-only module load outside a server component.
vi.mock("server-only", () => ({}))

describe("sumOrderHistory", () => {
  it("sums the same rows by month and by week", () => {
    const { monthly, weekly } = sumOrderHistory()
    const byMonth = monthly.reduce((sum, row) => sum + row.total, 0)
    const byWeek = weekly.reduce((sum, row) => sum + row.total, 0)

    expect(byMonth).toBe(byWeek)
    expect(byMonth).toBeGreaterThan(orderHistoryRows * 500)
  })

  it("covers January to October, by region", () => {
    const { monthly } = sumOrderHistory()

    expect(monthly.map((row) => row.start)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `2026-${String(index + 1).padStart(2, "0")}-01`
      )
    )
    for (const row of monthly) {
      expect(Object.keys(row.byRegion).sort()).toEqual([
        "East",
        "North",
        "South",
        "West",
      ])
    }
  })

  it("keeps the first few rows for a table", () => {
    const { rows } = sumOrderHistory()

    expect(rows).toHaveLength(6)
    expect(rows[0]?.id).toBe("ORD-10001")
  })

  it("gives the same totals every time", () => {
    expect(sumOrderHistory()).toEqual(sumOrderHistory())
  })
})
