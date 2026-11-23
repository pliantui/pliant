"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { keyMetricsAsks } from "@/lib/demo/asks"
import type { MonthlyRevenue } from "@/lib/demo/schema"
import type { OrderStats } from "@/lib/demo/stats"
import { AnalyticsDashboard } from "@/registry/blocks/analytics-dashboard/analytics-dashboard"

const chartAsks = {
  line: "make the chart a line chart",
  stack: "stack by status",
  quarter: "only show last quarter",
}

export function AnalyticsDashboardDemo({
  stats,
  revenue,
}: {
  stats: OrderStats
  revenue: MonthlyRevenue[]
}) {
  const scripted = useScriptedAsks()

  return (
    <DemoFrame
      target="key-metrics"
      label="the dashboard"
      asks={keyMetricsAsks}
      mocked={{
        label: "the chart",
        asks: Object.values(chartAsks),
        scripted,
        note: "Charts aren't in Pliant yet, so the chart's asks are scripted.",
      }}
      className="max-w-none"
    >
      <AnalyticsDashboard
        stats={stats}
        revenue={revenue}
        chart={{
          kind: scripted.has(chartAsks.line) ? "line" : "bar",
          stacked: scripted.has(chartAsks.stack),
          lastQuarter: scripted.has(chartAsks.quarter),
        }}
      />
    </DemoFrame>
  )
}
