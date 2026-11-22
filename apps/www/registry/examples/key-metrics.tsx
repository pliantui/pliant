import { orders } from "@/lib/demo/data"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import { getOrderStats } from "@/lib/demo/stats"
import { PliantRegion } from "@/registry/pliant/pliant-region"

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-1 rounded-xl border bg-background p-4"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}

// The key metrics region the AI examples point at and ask about.
export function KeyMetrics() {
  const stats = getOrderStats(orders)

  return (
    <section aria-label="Key metrics">
      <PliantRegion
        id="key-metrics"
        className="grid-cols-2"
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
    </section>
  )
}
