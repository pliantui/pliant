import { describe, expect, it } from "vitest"

import { addressSchema, nodeIdSchema, slotIdSchema } from "./address"
import { surfaceSchema } from "./surface"

describe("addressSchema", () => {
  it.each([
    "orders-table",
    "orders-table/columns/value",
    "ticket-form/fields/priority",
    "ticket-form/fields/firstName",
    "ticket-form/fields/first_name",
    "app-sidebar/items/reports",
    "order-card[]/actions/refund",
    "checkout-actions/slots/pay-now",
    "page/slots/summary/columns/total",
  ])("accepts %s", (address) => {
    expect(addressSchema.safeParse(address).success).toBe(true)
  })

  it.each([
    "",
    "2024-orders",
    "Orders-table",
    "orders--table",
    "orders-table-",
    "orders-table/rows/1",
    "orders-table/columns",
    "orders-table/columns/2024",
    "orders-table/columns/customer.region",
    "checkout-actions/slots/payNow",
    "order-card/actions/refund[]",
    "orders-table/",
  ])("rejects %j", (address) => {
    expect(addressSchema.safeParse(address).success).toBe(false)
  })
})

describe("nodeIdSchema", () => {
  it("accepts templates", () => {
    expect(nodeIdSchema.safeParse("order-card[]").success).toBe(true)
  })

  it("rejects ids that start with a digit", () => {
    expect(nodeIdSchema.safeParse("7-day-chart").success).toBe(false)
  })
})

describe("slotIdSchema", () => {
  it.each(["2024", "7", "01", "-1", "1a"])(
    "rejects %j, which could reorder an object's keys",
    (id) => {
      expect(slotIdSchema.safeParse(id).success).toBe(false)
    }
  )

  it("rejects templates", () => {
    expect(slotIdSchema.safeParse("card[]").success).toBe(false)
  })
})

describe("surfaceSchema", () => {
  it.each([
    "/",
    "/orders",
    "/orders/[id]",
    "/docs/[...slug]",
    "/shop/[[...filters]]",
    "/files/.well-known",
    "/products/[product-id]",
    "/caf%C3%A9",
    "/%E2%82%AC",
    "/%F0%9F%98%80",
    "app-shell",
    "@app",
  ])("accepts %s", (surface) => {
    expect(surfaceSchema.safeParse(surface).success).toBe(true)
  })

  it.each([
    "",
    "orders/[id]",
    "/orders/",
    "//orders",
    "/.",
    "/..",
    "/orders/..",
    "/a/../b",
    "/./orders",
    "/...",
    "/%7E",
    "/%C3%a9",
    "/%2e",
    "/%2E%2E",
    "/a%2E%2E",
    "/%41",
    "/a%2Fb",
    "/%FF",
    "/%C3",
    "/%80",
    "/%C0%AE",
    "/%ED%A0%80",
    "/caf\u00e9",
    "/\u{1F600}",
    "/a\u00a0b",
    "/a\u202eb",
    "/\ud800",
    "@surface",
    "/orders?id=1",
  ])("rejects %j", (surface) => {
    expect(surfaceSchema.safeParse(surface).success).toBe(false)
  })
})
