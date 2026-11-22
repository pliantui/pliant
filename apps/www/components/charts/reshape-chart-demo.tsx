"use client"

import { DemoChart, type DemoChartRow } from "@/components/demo/demo-chart"
import { useScriptedAsks } from "@/components/demo/scripted-frame"
import { formatCurrency } from "@/lib/demo/format"
import type { MonthlyRevenue } from "@/lib/demo/schema"

import { ChartExampleCard } from "./chart-example-card"

const asks = {
  line: "make this a line chart",
  stack: "stack by status",
  monthly: "show monthly instead",
}

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const statuses = ["paid", "pending", "overdue"] as const

function rowOf(label: string, months: MonthlyRevenue[]): DemoChartRow {
  const values: Record<string, number> = { total: 0 }
  for (const status of statuses) {
    values[status] = months.reduce((sum, row) => sum + row[status], 0)
    values["total"] = (values["total"] ?? 0) + (values[status] ?? 0)
  }
  return { label, values }
}

export function ReshapeChartDemo({ revenue }: { revenue: MonthlyRevenue[] }) {
  const scripted = useScriptedAsks()
  const monthly = scripted.has(asks.monthly)
  const stacked = scripted.has(asks.stack)
  const rows = monthly
    ? revenue.map((row) => rowOf(month.format(new Date(row.month)), [row]))
    : [1, 2, 3, 4].map((quarter) =>
        rowOf(
          `Q${String(quarter)}`,
          revenue.filter(
            (row) => Math.ceil(Number(row.month.slice(5, 7)) / 3) === quarter
          )
        )
      )

  return (
    <ChartExampleCard
      id="chart-reshape"
      title="Order value"
      description={`By ${monthly ? "month" : "quarter"}, Jan–Oct 2026${stacked ? ", split by status" : ""}.`}
      label="the chart"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <DemoChart
        rows={rows}
        series={
          stacked
            ? [
                { key: "paid", label: "Paid" },
                { key: "pending", label: "Pending" },
                { key: "overdue", label: "Overdue" },
              ]
            : [{ key: "total", label: "Order value" }]
        }
        kind={scripted.has(asks.line) ? "line" : "bar"}
        stacked={stacked}
        caption="Order value"
        formatValue={formatCurrency}
      />
    </ChartExampleCard>
  )
}
