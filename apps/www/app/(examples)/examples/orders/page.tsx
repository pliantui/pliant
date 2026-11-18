import type { Metadata } from "next"

import { KpiCard } from "./components/kpi-card"
import { OrdersTable } from "./components/orders-table"
import { orders } from "./data"
import { formatCurrency, formatNumber } from "./format"
import { getOrderStats } from "./stats"

export const metadata: Metadata = {
  title: "Orders",
}

export default function OrdersPage() {
  const stats = getOrderStats(orders)
  const kpis = [
    {
      id: "revenue",
      label: "Revenue",
      value: formatCurrency(stats.revenue),
      definition: "Total value of paid orders",
    },
    {
      id: "orders",
      label: "Orders",
      value: formatNumber(stats.orders),
      definition: "All orders placed",
    },
    {
      id: "average-order-value",
      label: "Average order value",
      value: formatCurrency(stats.averageOrderValue),
      definition: "Revenue per paid order",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: formatNumber(stats.overdue),
      definition: "Orders marked overdue",
    },
  ]

  return (
    <main className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Orders placed Jan–Oct 2026
          </p>
        </header>
        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} />
          ))}
        </section>
        <OrdersTable data={orders} />
      </div>
    </main>
  )
}
