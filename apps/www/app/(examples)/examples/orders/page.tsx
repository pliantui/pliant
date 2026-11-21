import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { inventory } from "@/lib/pliant/inventory.generated"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { AskToolbar } from "./components/ask-toolbar"
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
    <main
      id="main"
      tabIndex={-1}
      className="flex-1 bg-background text-foreground outline-none max-sm:has-[[data-slot=pliant-ask-panel]]:pb-[60dvh] sm:has-[[data-slot=pliant-ask-panel]]:pr-96"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <PliantRoot
          surface="/examples/orders"
          storage={localAdapter}
          inventory={inventory["/examples/orders"]}
        >
          <PliantPrePaint surface="/examples/orders" />
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
              <p className="text-sm text-muted-foreground">
                Orders placed Jan–Oct 2026
              </p>
            </div>
            <AskToolbar />
          </header>
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
              className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
            />
          </section>
          <OrdersTable data={orders} />
        </PliantRoot>
      </div>
    </main>
  )
}
