import type { Metadata } from "next"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { orders } from "./data"
import { formatCurrency } from "./format"
import { OrdersTable } from "./orders-table"
import { getOrderStats } from "./stats"

export const metadata: Metadata = {
  title: "Orders",
}

export default function OrdersPage() {
  const stats = getOrderStats(orders)
  const kpis = [
    { label: "Revenue", value: formatCurrency(stats.revenue) },
    { label: "Orders", value: stats.orders.toLocaleString("en-IN") },
    {
      label: "Average order value",
      value: formatCurrency(stats.averageOrderValue),
    },
    { label: "Overdue", value: stats.overdue.toLocaleString("en-IN") },
  ]

  return (
    <main className="flex-1 bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Revenue counts paid orders. Everything else spans all orders.
          </p>
        </header>
        <section
          aria-label="Key metrics"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {kpis.map((kpi) => (
            <Card
              key={kpi.label}
              role="group"
              aria-label={kpi.label}
              className="gap-2 border-border py-4"
            >
              <CardHeader>
                <CardDescription>{kpi.label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {kpi.value}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>
        <OrdersTable data={orders} />
      </div>
    </main>
  )
}
