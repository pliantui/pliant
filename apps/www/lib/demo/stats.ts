import type { Order } from "./schema"

export interface OrderStats {
  revenue: number
  orders: number
  averageOrderValue: number
  overdue: number
}

export function getOrderStats(orders: Order[]): OrderStats {
  const paid = orders.filter((order) => order.status === "paid")
  const revenue = paid.reduce((total, order) => total + order.value, 0)

  return {
    revenue,
    orders: orders.length,
    averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
    overdue: orders.filter((order) => order.status === "overdue").length,
  }
}

// The share of the latest quarter's orders that were refunded, as a
// fraction, and the quarter it covers, like "Q4 2026".
export function getQuarterRefundRate(orders: Order[]) {
  const latest = orders.reduce(
    (last, order) => (order.createdAt > last ? order.createdAt : last),
    ""
  )
  const date = new Date(latest)
  const year = date.getUTCFullYear()
  const quarter = Math.floor(date.getUTCMonth() / 3)
  const inQuarter = orders.filter((order) => {
    const created = new Date(order.createdAt)
    return (
      created.getUTCFullYear() === year &&
      Math.floor(created.getUTCMonth() / 3) === quarter
    )
  })
  const refunded = inQuarter.filter((order) => order.status === "refunded")
  return {
    quarter: `Q${String(quarter + 1)} ${String(year)}`,
    rate: inQuarter.length ? refunded.length / inQuarter.length : 0,
  }
}
