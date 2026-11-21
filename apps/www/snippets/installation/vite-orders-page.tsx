// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { PliantRegion } from "@/components/pliant/pliant-region"

import { StatCard } from "./stat-card"

export function OrdersPage() {
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
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
