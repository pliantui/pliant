import type { Order } from "./data"

export interface OrderStats {
  revenue: number
  orders: number
  averageOrderValue: number
  overdue: number
}

export function getOrderStats(orders: Order[]): OrderStats {
  const revenue = orders
    .filter((order) => order.status === "paid")
    .reduce((total, order) => total + order.value, 0)
  const value = orders.reduce((total, order) => total + order.value, 0)

  return {
    revenue,
    orders: orders.length,
    averageOrderValue: orders.length ? Math.round(value / orders.length) : 0,
    overdue: orders.filter((order) => order.status === "overdue").length,
  }
}
