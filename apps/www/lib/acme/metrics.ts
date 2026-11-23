import { monthlyFigures, type MonthlyFigures } from "./data"

export interface Metric {
  id: "revenue" | "new-customers" | "active-accounts" | "growth-rate"
  label: string
  value: string
  // The change from last month, in percent, or in points for a rate.
  change: number
  changeLabel: string
  trend: string
  caption: string
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})
const count = new Intl.NumberFormat("en-US")
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })
const signed = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

function percentChange(from: number, to: number) {
  return ((to - from) / Math.abs(from)) * 100
}

function lastTwo(figures: readonly MonthlyFigures[]) {
  const current = figures.at(-1)
  const previous = figures.at(-2)
  const before = figures.at(-3)
  if (!current || !previous || !before) {
    throw new Error("The metrics need at least three months of figures")
  }
  return { current, previous, before }
}

export function formatUsd(value: number) {
  return usd.format(value)
}

// The dashboard's four metric cards, each this month against last month.
export function getMetrics(
  figures: readonly MonthlyFigures[] = monthlyFigures
): Metric[] {
  const { current, previous, before } = lastTwo(figures)
  const revenue = percentChange(previous.revenue, current.revenue)
  const customers = percentChange(previous.newCustomers, current.newCustomers)
  const accounts = percentChange(
    previous.activeAccounts,
    current.activeAccounts
  )
  const lastGrowth = percentChange(
    before.activeAccounts,
    previous.activeAccounts
  )
  const growthChange = accounts - lastGrowth

  return [
    {
      id: "revenue",
      label: "Total Revenue",
      value: usd.format(current.revenue),
      change: revenue,
      changeLabel: `${signed.format(revenue)}%`,
      trend: revenue >= 0 ? "Trending up this month" : "Down this month",
      caption: "Revenue for November",
    },
    {
      id: "new-customers",
      label: "New Customers",
      value: count.format(current.newCustomers),
      change: customers,
      changeLabel: `${signed.format(customers)}%`,
      trend:
        customers >= 0
          ? "Up this month"
          : `Down ${plain.format(Math.abs(customers))}% this month`,
      caption:
        customers >= 0 ? "Acquisition on track" : "Acquisition needs attention",
    },
    {
      id: "active-accounts",
      label: "Active Accounts",
      value: count.format(current.activeAccounts),
      change: accounts,
      changeLabel: `${signed.format(accounts)}%`,
      trend: accounts >= 0 ? "Strong user retention" : "Retention slipping",
      caption: "Accounts active this month",
    },
    {
      id: "growth-rate",
      label: "Growth Rate",
      value: `${signed.format(accounts).replace("+", "")}%`,
      change: growthChange,
      changeLabel: `${signed.format(growthChange)} pts`,
      trend:
        growthChange >= 0 ? "Steady performance increase" : "Growth is slowing",
      caption: "Growth in active accounts",
    },
  ]
}

// This month's revenue against last month's, for the card an ask adds.
export function getRevenueComparison(
  figures: readonly MonthlyFigures[] = monthlyFigures
) {
  const { current, previous } = lastTwo(figures)
  return {
    current: current.revenue,
    previous: previous.revenue,
    difference: current.revenue - previous.revenue,
    change: percentChange(previous.revenue, current.revenue),
  }
}
