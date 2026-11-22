import { DashboardCardDemo } from "@/components/charts/dashboard-card-demo"
import { ServerChartDemo } from "@/components/charts/server-chart-demo"
import {
  TableToChartDemo,
  type StatusTotals,
} from "@/components/charts/table-to-chart-demo"
import { monthlyRevenue, orders } from "@/lib/demo/data"
import { orderHistoryRows, sumOrderHistory } from "@/lib/demo/order-history"
import { orderRegions, type Order } from "@/lib/demo/schema"
import { getOrderStats } from "@/lib/demo/stats"

export const dynamic = "force-static"
export const revalidate = false

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

function statusTotals(label: string, rows: Order[]): StatusTotals {
  const sum = (status: Order["status"]) =>
    rows
      .filter((order) => order.status === status)
      .reduce((total, order) => total + order.value, 0)
  return {
    label,
    orders: rows.filter((order) => order.status === "paid").length,
    paid: sum("paid"),
    pending: sum("pending"),
    overdue: sum("overdue"),
  }
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
  const months = monthlyRevenue.map(({ month: start }) => start.slice(0, 7))
  const history = sumOrderHistory()

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <Example
        id="from-a-table"
        title="From a table"
        description="Ask for a chart of a table's numbers, and it appears above the table. Then reshape the chart with more asks; they combine, and a second press takes one back."
      >
        <TableToChartDemo
          regions={orderRegions.map((region) =>
            statusTotals(
              region,
              orders.filter((order) => order.region === region)
            )
          )}
          months={months.map((key) =>
            statusTotals(
              month.format(new Date(`${key}-01`)),
              orders.filter((order) => order.createdAt.startsWith(key))
            )
          )}
        />
      </Example>
      <Example
        id="from-a-dashboard"
        title="From a dashboard"
        description="Ask a dashboard for a chart, and it gets a card of its own beside the figures."
      >
        <DashboardCardDemo
          stats={getOrderStats(orders)}
          overdueByMonth={months.map((key) => ({
            label: month.format(new Date(`${key}-01`)),
            count: orders.filter(
              (order) =>
                order.status === "overdue" && order.createdAt.startsWith(key)
            ).length,
          }))}
        />
      </Example>
      <Example
        id="server-mode"
        title="Server mode"
        description="With too many rows to send to the browser, the chart gets totals instead: the table shows a few rows, and the chart sums all of them."
      >
        <ServerChartDemo
          rows={history.rows}
          count={orderHistoryRows}
          monthly={history.monthly}
          weekly={history.weekly}
        />
      </Example>
    </div>
  )
}
