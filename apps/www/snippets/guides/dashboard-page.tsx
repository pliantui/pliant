// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

import { ChartCard, StatCard } from "./cards"

const surface = "/dashboard"

export default function DashboardPage() {
  return (
    <PliantRoot surface={surface} storage={localAdapter}>
      <PliantPrePaint surface={surface} />
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <StatCard label="Revenue" value="₹4,821,000" />,
          orders: <StatCard label="Orders" value="200" />,
          "average-order-value": (
            <StatCard label="Average order value" value="₹24,105" />
          ),
          overdue: <StatCard label="Overdue" value="17" />,
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
      />
      <PliantRegion
        id="charts"
        slots={{
          "revenue-by-month": <ChartCard title="Revenue by month" />,
          "orders-by-region": <ChartCard title="Orders by region" />,
          "top-customers": <ChartCard title="Top customers" />,
        }}
        className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"
      />
    </PliantRoot>
  )
}
// #endregion page
