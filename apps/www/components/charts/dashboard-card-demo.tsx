"use client"

import { DemoChart } from "@/components/demo/demo-chart"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { OrderStats } from "@/lib/demo/stats"

import { ChartExampleCard } from "./chart-example-card"
import { useChartAsks } from "./use-chart-asks"

const chartAsk = "chart overdue orders by month"

const reshapeAsks = {
  line: "make this a line chart",
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-1 rounded-lg border bg-background p-3"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function DashboardCardDemo({
  stats,
  overdueByMonth,
}: {
  stats: OrderStats
  overdueByMonth: { label: string; count: number }[]
}) {
  const { chart, reshape, charted } = useChartAsks(chartAsk)

  return (
    <ChartExampleCard
      id="chart-from-dashboard"
      title="Sales overview"
      description="Orders placed Jan–Oct 2026."
      label="the overview"
      asks={[chartAsk]}
      scripted={chart}
      followUps={
        charted
          ? {
              label: "the overdue chart",
              asks: Object.values(reshapeAsks),
              scripted: reshape,
            }
          : undefined
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Revenue" value={formatCurrency(stats.revenue)} />
        <Stat label="Orders" value={formatNumber(stats.orders)} />
        <Stat
          label="Average order value"
          value={formatCurrency(stats.averageOrderValue)}
        />
        <Stat label="Overdue" value={formatNumber(stats.overdue)} />
        {charted && (
          <section
            aria-label="Overdue orders by month"
            className="col-span-2 flex flex-col gap-2 rounded-lg border bg-background p-3"
          >
            <span className="text-xs text-muted-foreground">
              Overdue orders by month
            </span>
            <DemoChart
              rows={overdueByMonth.map((row) => ({
                label: row.label,
                values: { overdue: row.count },
              }))}
              series={[{ key: "overdue", label: "Overdue orders" }]}
              kind={reshape.has(reshapeAsks.line) ? "line" : "bar"}
              caption="Overdue orders by month"
              formatValue={formatNumber}
            />
          </section>
        )}
      </div>
    </ChartExampleCard>
  )
}
