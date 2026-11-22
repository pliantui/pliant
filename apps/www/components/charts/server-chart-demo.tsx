"use client"

import { DemoChart } from "@/components/demo/demo-chart"
import { useScriptedAsks } from "@/components/demo/scripted-frame"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { OrderHistoryTotals } from "@/lib/demo/order-history"
import { orderRegions } from "@/lib/demo/schema"

import { ChartExampleCard } from "./chart-example-card"

const asks = {
  region: "split by region",
  weekly: "show weekly instead",
}

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const day = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

export function ServerChartDemo({
  totals,
  rows,
}: {
  totals: OrderHistoryTotals
  // How many rows the server summed.
  rows: number
}) {
  const scripted = useScriptedAsks()
  const weekly = scripted.has(asks.weekly)
  const byRegion = scripted.has(asks.region)
  const points = weekly ? totals.weekly : totals.monthly
  const format = weekly ? day : month

  return (
    <ChartExampleCard
      id="chart-server"
      title="Order history"
      description={`Every order since January, by ${weekly ? "week" : "month"}${byRegion ? " and region" : ""}.`}
      label="the order history chart"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <DemoChart
        rows={points.map((point) => ({
          label: format.format(new Date(point.start)),
          values: { total: point.total, ...point.byRegion },
        }))}
        series={
          byRegion
            ? orderRegions.map((region) => ({ key: region, label: region }))
            : [{ key: "total", label: "Order value" }]
        }
        kind={weekly ? "line" : "bar"}
        stacked={byRegion}
        caption="Order history"
        formatValue={formatCurrency}
      />
      <p className="text-xs text-muted-foreground">
        {formatNumber(rows)} orders, summed on the server into{" "}
        {formatNumber(points.length)} points.
      </p>
    </ChartExampleCard>
  )
}
