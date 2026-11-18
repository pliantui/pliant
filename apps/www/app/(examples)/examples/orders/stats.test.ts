import { describe, expect, it } from "vitest"

import type { Order } from "./data"
import { getOrderStats } from "./stats"

function order(status: Order["status"], value: number): Order {
  return {
    id: `ORD-${status}-${String(value)}`,
    customer: "Test",
    region: "North",
    status,
    value,
    createdAt: "2026-01-01T00:00:00.000Z",
    notes: "",
  }
}

describe("getOrderStats", () => {
  it("sums paid orders as revenue and averages over paid orders", () => {
    const stats = getOrderStats([
      order("paid", 1000),
      order("paid", 2001),
      order("pending", 50000),
      order("refunded", 70000),
    ])

    expect(stats.revenue).toBe(3001)
    expect(stats.averageOrderValue).toBe(1501)
  })

  it("counts all orders and the overdue ones", () => {
    const stats = getOrderStats([
      order("overdue", 100),
      order("overdue", 200),
      order("paid", 300),
    ])

    expect(stats.orders).toBe(3)
    expect(stats.overdue).toBe(2)
  })

  it("returns zeros without orders", () => {
    expect(getOrderStats([])).toEqual({
      revenue: 0,
      orders: 0,
      averageOrderValue: 0,
      overdue: 0,
    })
  })
})
