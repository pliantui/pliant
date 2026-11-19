import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"

import { PliantRegion } from "@/registry/pliant/pliant-region"

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

  return (
    <main className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Orders placed Jan–Oct 2026
          </p>
        </header>
        <PliantRoot surface="/examples/orders">
          <section aria-label="Key metrics">
            <PliantRegion
              id="key-metrics"
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
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            />
          </section>
          <OrdersTable data={orders} />
        </PliantRoot>
      </div>
    </main>
  )
}
