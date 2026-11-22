import { KpiCard } from "@/app/(examples)/examples/orders/components/kpi-card"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import type { OrderStats } from "@/lib/demo/stats"
import { PliantRegion } from "@/registry/pliant/pliant-region"

// The company's key figures, as cards the user can reorder, hide and lay
// out.
export function KeyMetrics({ stats }: { stats: OrderStats }) {
  return (
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
  )
}
