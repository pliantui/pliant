import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { ReplayNote } from "@/components/demo/replay-note"
import { orders } from "@/lib/demo/data"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import { getOrderStats } from "@/lib/demo/stats"
import { inventory } from "@/lib/pliant/inventory.generated"
import { KpiCard } from "@/registry/blocks/analytics-dashboard/kpi-card"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { OrdersDemo } from "./components/orders-demo"
import { OrdersTable } from "./components/orders-table"

export const metadata: Metadata = {
  title: "Orders",
  alternates: { canonical: "/examples/orders" },
}

export default function OrdersPage() {
  const stats = getOrderStats(orders)

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <PliantRoot
          surface="/examples/orders"
          storage={localAdapter}
          inventory={inventory["/examples/orders"]}
        >
          <PliantPrePaint surface="/examples/orders" />
          <OrdersDemo
            header={
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Orders
                </h2>
                <p className="text-sm text-muted-foreground">
                  Orders placed Jan–Oct 2026
                </p>
                <ReplayNote />
              </div>
            }
            metrics={
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
            }
            table={<OrdersTable data={orders} />}
          />
        </PliantRoot>
      </div>
    </div>
  )
}
