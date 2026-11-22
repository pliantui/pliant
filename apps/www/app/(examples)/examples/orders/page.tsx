import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { CustomizedReset } from "@/components/demo/customized-reset"
import { DemoAskToolbar } from "@/components/demo/demo-ask-toolbar"
import { ReplayNote } from "@/components/demo/replay-note"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { orders } from "@/lib/demo/data"
import { formatCurrency, formatNumber } from "@/lib/demo/format"
import { getOrderStats } from "@/lib/demo/stats"
import { inventory } from "@/lib/pliant/inventory.generated"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { askTargets } from "./ask-targets"
import { KpiCard } from "./components/kpi-card"
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
          <NotImplementedBanner variant="preview">
            The Customized badge previews an indicator that isn&apos;t in Pliant
            yet.
          </NotImplementedBanner>
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight">Orders</h2>
              <p className="text-sm text-muted-foreground">
                Orders placed Jan–Oct 2026
              </p>
              <ReplayNote />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <CustomizedReset
                targets={["key-metrics", "orders-table"]}
                label="the orders page"
              />
              <DemoAskToolbar targets={askTargets} />
            </div>
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
    </div>
  )
}
