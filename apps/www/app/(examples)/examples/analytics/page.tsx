import type { Metadata } from "next"

import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { AnalyticsDashboardDemo } from "@/components/blocks/analytics-dashboard-demo"
import { OrdersListDemo } from "@/components/blocks/orders-list-demo"
import { monthlyRevenue, orders } from "@/lib/demo/data"
import { getOrderStats } from "@/lib/demo/stats"
import { inventory } from "@/lib/pliant/inventory.generated"

export const metadata: Metadata = {
  title: "Analytics",
  alternates: { canonical: "/examples/analytics" },
}

export default function AnalyticsPage() {
  const recent = orders
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 24)

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 lg:px-6">
        <PliantRoot
          surface="/examples/analytics"
          storage={localAdapter}
          inventory={inventory["/examples/analytics"]}
        >
          <PliantPrePaint surface="/examples/analytics" />
          <header className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
            <p className="text-sm text-muted-foreground">
              Orders placed Jan–Oct 2026
            </p>
          </header>
          <AnalyticsDashboardDemo
            stats={getOrderStats(orders)}
            revenue={monthlyRevenue}
          />
          <section
            aria-labelledby="latest-orders"
            className="flex flex-col gap-4"
          >
            <h3 id="latest-orders" className="text-lg font-semibold">
              Latest orders
            </h3>
            <OrdersListDemo data={recent} />
          </section>
        </PliantRoot>
      </div>
    </div>
  )
}
