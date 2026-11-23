import { describe, expect, it } from "vitest"

import { getMetrics, getRevenueComparison } from "./metrics"

describe("getMetrics", () => {
  it("compares this month with last month", () => {
    const [revenue, customers, accounts, growth] = getMetrics()

    expect(revenue).toMatchObject({
      label: "Total Revenue",
      value: "$125,000.00",
      changeLabel: "+12.5%",
    })
    expect(customers).toMatchObject({ value: "1,234", changeLabel: "-20.1%" })
    expect(accounts).toMatchObject({ value: "45,678", changeLabel: "+4.5%" })
    expect(growth).toMatchObject({ value: "4.5%", changeLabel: "+4.5 pts" })
  })

  it("reads a fall as a fall", () => {
    const [revenue] = getMetrics([
      {
        month: "2026-01-01",
        revenue: 100,
        newCustomers: 1,
        activeAccounts: 10,
      },
      {
        month: "2026-02-01",
        revenue: 200,
        newCustomers: 1,
        activeAccounts: 10,
      },
      {
        month: "2026-03-01",
        revenue: 150,
        newCustomers: 1,
        activeAccounts: 10,
      },
    ])
    expect(revenue).toMatchObject({
      changeLabel: "-25%",
      trend: "Down this month",
    })
  })
})

describe("getRevenueComparison", () => {
  it("gives both months and the change", () => {
    expect(getRevenueComparison()).toEqual({
      current: 125_000,
      previous: 111_100,
      difference: 13_900,
      change: expect.closeTo(12.51, 2) as number,
    })
  })
})
