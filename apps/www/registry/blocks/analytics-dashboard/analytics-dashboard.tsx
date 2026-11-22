import { DemoChart } from "@/components/demo/demo-chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { MonthlyRevenue } from "@/lib/demo/schema"
import type { OrderStats } from "@/lib/demo/stats"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { KpiCard } from "./kpi-card"

export interface RevenueChartView {
  kind: "bar" | "line"
  stacked: boolean
  lastQuarter: boolean
}

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const statusSeries = [
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
]

const totalSeries = [{ key: "total", label: "Order value" }]

// Key metrics the user can rearrange, above a chart of order value by
// month.
export function AnalyticsDashboard({
  stats,
  revenue,
  chart,
}: {
  stats: OrderStats
  revenue: MonthlyRevenue[]
  chart: RevenueChartView
}) {
  // Jul–Sep 2026 is the last full quarter in the data.
  const months = chart.lastQuarter
    ? revenue.filter((row) => row.month >= "2026-07" && row.month < "2026-10")
    : revenue
  const rows = months.map((row) => ({
    label: month.format(new Date(row.month)),
    values: {
      paid: row.paid,
      pending: row.pending,
      overdue: row.overdue,
      total: row.paid + row.pending + row.overdue,
    },
  }))

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Key metrics">
        <PliantRegion
          id="key-metrics"
          className="grid grid-cols-2 gap-4 xl:grid-cols-4"
          slots={{
            revenue: (
              <KpiCard
                label="Revenue"
                value={formatCurrency(stats.revenue)}
                definition="Total value of paid orders"
              />
            ),
            orders: (
              <KpiCard
                label="Orders"
                value={formatNumber(stats.orders)}
                definition="All orders placed"
              />
            ),
            "average-order-value": (
              <KpiCard
                label="Average order value"
                value={formatCurrency(stats.averageOrderValue)}
                definition="Revenue per paid order"
              />
            ),
            overdue: (
              <KpiCard
                label="Overdue"
                value={formatNumber(stats.overdue)}
                definition="Orders marked overdue"
              />
            ),
          }}
        />
      </section>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Order value</CardTitle>
          <CardDescription>
            {chart.lastQuarter
              ? "By month, Jul–Sep 2026"
              : "By month, Jan–Oct 2026"}
            {chart.stacked ? ", split by status" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DemoChart
            rows={rows}
            series={chart.stacked ? statusSeries : totalSeries}
            kind={chart.kind}
            stacked={chart.stacked}
            caption="Order value by month"
            formatValue={formatCurrency}
          />
        </CardContent>
      </Card>
    </div>
  )
}
