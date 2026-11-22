"use client"

import { useScriptedAsks } from "@/components/demo/scripted-frame"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { OrderStats } from "@/lib/demo/stats"

import { ChartExampleCard } from "./chart-example-card"

const cardAsk = "add a card with average order value"

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

export function DashboardCardDemo({ stats }: { stats: OrderStats }) {
  const scripted = useScriptedAsks()

  return (
    <ChartExampleCard
      id="chart-from-dashboard"
      title="Sales overview"
      description="Orders placed Jan–Oct 2026."
      label="the overview"
      asks={[cardAsk]}
      scripted={scripted}
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Revenue" value={formatCurrency(stats.revenue)} />
        <Stat label="Orders" value={formatNumber(stats.orders)} />
        <Stat label="Overdue" value={formatNumber(stats.overdue)} />
        {scripted.has(cardAsk) && (
          <Stat
            label="Average order value"
            value={formatCurrency(stats.averageOrderValue)}
          />
        )}
      </div>
    </ChartExampleCard>
  )
}
