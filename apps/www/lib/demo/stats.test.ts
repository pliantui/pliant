import { describe, expect, it } from "vitest"

import type { Order } from "./schema"
import { getOrderStats, getQuarterRefundRate } from "./stats"

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

describe("getQuarterRefundRate", () => {
  it("divides the latest quarter's refunded orders by its orders", () => {
    const at = (status: Order["status"], createdAt: string): Order => ({
      ...order(status, 100),
      id: `ORD-${createdAt}`,
      createdAt,
    })

    expect(
      getQuarterRefundRate([
        at("refunded", "2026-06-30T00:00:00.000Z"),
        at("refunded", "2026-07-02T00:00:00.000Z"),
        at("paid", "2026-08-10T00:00:00.000Z"),
        at("paid", "2026-09-30T00:00:00.000Z"),
        at("pending", "2026-09-01T00:00:00.000Z"),
      ])
    ).toEqual({ quarter: "Q3 2026", rate: 0.25 })
  })
})
