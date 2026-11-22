import { DashboardCardDemo } from "@/components/charts/dashboard-card-demo"
import { ReshapeChartDemo } from "@/components/charts/reshape-chart-demo"
import { ServerChartDemo } from "@/components/charts/server-chart-demo"
import { TableToChartDemo } from "@/components/charts/table-to-chart-demo"
import { monthlyRevenue, orders } from "@/lib/demo/data"
import { orderHistoryRows, sumOrderHistory } from "@/lib/demo/order-history"
import { orderRegions } from "@/lib/demo/schema"
import { getOrderStats } from "@/lib/demo/stats"

export const dynamic = "force-static"
export const revalidate = false

function regionTotals() {
  return orderRegions.map((region) => {
    const paid = orders.filter(
      (order) => order.region === region && order.status === "paid"
    )
    return {
      region,
      orders: paid.length,
      revenue: paid.reduce((sum, order) => sum + order.value, 0),
    }
  })
}

function Example({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 scroll-mt-24 flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="font-medium">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function ChartsPage() {
  return (
    <div id="charts" className="grid scroll-mt-24 gap-10 lg:grid-cols-2">
      <Example
        id="from-a-table"
        title="From a table"
        description="Ask for a chart of the numbers in a table, and it appears above the table."
      >
        <TableToChartDemo regions={regionTotals()} />
      </Example>
      <Example
        id="from-a-dashboard"
        title="From a dashboard"
        description="Ask a dashboard for another figure, and it gets a card of its own."
      >
        <DashboardCardDemo stats={getOrderStats(orders)} />
      </Example>
      <Example
        id="reshape-a-chart"
        title="Reshape a chart"
        description="Change a chart's type, split it into stacks, or count by another period. Asks combine, and a second press takes one back."
      >
        <ReshapeChartDemo revenue={monthlyRevenue} />
      </Example>
      <Example
        id="server-mode"
        title="Server mode"
        description="With too many rows for the browser, the database groups and sums them, and the chart gets only the totals."
      >
        <ServerChartDemo totals={sumOrderHistory()} rows={orderHistoryRows} />
      </Example>
    </div>
  )
}
