// #region usage
import { PliantRegion } from "@/components/pliant/pliant-region"

export function KeyMetrics() {
  return (
    <PliantRegion
      id="key-metrics"
      className="grid-cols-2 md:grid-cols-4"
      slots={{
        revenue: <StatCard label="Revenue" value="₹37,76,600" />,
        orders: <StatCard label="Orders" value="200" />,
        "average-order-value": (
          <StatCard label="Average order value" value="₹85,832" />
        ),
        overdue: <StatCard label="Overdue" value="56" />,
      }}
    />
  )
}
// #endregion usage

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
