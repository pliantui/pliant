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
