import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { OrderStats } from "@/lib/demo/stats"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { ShowcaseCard } from "./showcase-card"

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

export function StatsCard({ stats }: { stats: OrderStats }) {
  return (
    <ShowcaseCard
      title="Key metrics"
      description="Orders placed Jan–Oct 2026."
      target="key-metrics"
      asks={["put the overdue card first", "hide the average order value card"]}
    >
      <PliantRegion
        id="key-metrics"
        className="grid grid-cols-2 gap-2"
        slots={{
          revenue: (
            <Stat label="Revenue" value={formatCurrency(stats.revenue)} />
          ),
          orders: <Stat label="Orders" value={formatNumber(stats.orders)} />,
          "average-order-value": (
            <Stat
              label="Average order value"
              value={formatCurrency(stats.averageOrderValue)}
            />
          ),
          overdue: <Stat label="Overdue" value={formatNumber(stats.overdue)} />,
        }}
      />
    </ShowcaseCard>
  )
}
