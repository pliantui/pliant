// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function OrdersPage() {
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
      <PliantPrePaint surface="/orders" />
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <StatCard label="Revenue" value="₹48,21,000" />,
          orders: <StatCard label="Orders" value="200" />,
          overdue: <StatCard label="Overdue" value="17" />,
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      />
    </PliantRoot>
  )
}
// #endregion page

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}
