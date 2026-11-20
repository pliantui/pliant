import { describe, expect, it } from "vitest"
import * as z from "zod"

import {
  addressSchema,
  itemAddressSchema,
  nodeAddressSchema,
  nodeIdSchema,
  slotIdSchema,
} from "./address"
import { opSchema } from "./op"
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

describe("per-row addresses", () => {
  const reserved = { code: "per-row-address-reserved" }

  function issuesOf(schema: z.ZodType, value: unknown) {
    return schema.safeParse(value).error?.issues ?? []
  }

  it.each([
    ["addressSchema", addressSchema, "order-card[42]"],
    ["addressSchema", addressSchema, "order-card[42]/actions/refund"],
    ["addressSchema", addressSchema, "order-card[aZ_-9]/actions/refund"],
    ["addressSchema", addressSchema, "order-card[42]/bogus"],
    ["nodeIdSchema", nodeIdSchema, "order-card[42]"],
    ["itemAddressSchema", itemAddressSchema("actions"), "card[k]/actions/x"],
    ["itemAddressSchema", itemAddressSchema(), "card[k]/slots/body"],
    ["nodeAddressSchema", nodeAddressSchema(), "card[k]"],
    [
      "nodeAddressSchema",
      nodeAddressSchema({ template: false }),
      "card[k]/slots/body",
    ],
  ] as const)(
    "%s reports only per-row-address-reserved for %j",
    (_, schema, value) => {
      expect(issuesOf(schema, value)).toEqual([
        expect.objectContaining({ code: "custom", params: reserved }),
      ])
    }
  )

  it.each([
    "order-card[]x",
    "order-card[42]x",
    "order-card[",
    "order-card]",
    "orders-table/columns/total[1]",
    "order-card[a b]",
    "order-card[a.b]/actions/refund",
  ])("reports %j as malformed, not reserved", (value) => {
    const issues = issuesOf(addressSchema, value)
    expect(issues).toEqual([
      expect.objectContaining({ code: "invalid_format" }),
    ])
  })

  it("reports a reserved address over the length limit as reserved first", () => {
    const value = `order-card[${"k".repeat(300)}]`
    const [first, ...rest] = issuesOf(addressSchema, value)
    expect(first).toEqual(
      expect.objectContaining({ code: "custom", params: reserved })
    )
    // Older Zod 4 releases run length checks even after an aborting issue.
    expect(rest).toEqual(
      rest.length === 0 ? [] : [expect.objectContaining({ code: "too_big" })]
    )
  })

  it.each([
    ["hide", "order-card[42]/actions/refund"],
    ["remove", "order-card[42]"],
    ["remove", "order-card[42]/slots/body"],
  ])("reports a per-row %s target as reserved", (op, target) => {
    expect(issuesOf(opSchema, { op, target })).toEqual([
      expect.objectContaining({ path: ["target"], params: reserved }),
    ])
  })

  it("reports a non-string target as the wrong type, not as reserved", () => {
    expect(
      issuesOf(opSchema, { op: "remove", target: ["order-card[42]"] })
    ).toEqual([expect.not.objectContaining({ params: reserved })])
  })

  it("still reports other remove targets as malformed", () => {
    expect(
      issuesOf(opSchema, { op: "remove", target: "card[]/slots/body" })
    ).toEqual([
      expect.objectContaining({ path: ["target"], code: "invalid_union" }),
    ])
  })

  it("keeps per-row addresses out of the JSON Schema", () => {
    const { pattern } = z
      .object({ pattern: z.string() })
      .parse(z.toJSONSchema(addressSchema))
    expect(new RegExp(pattern).test("order-card[42]")).toBe(false)
    expect(new RegExp(pattern).test("order-card[]")).toBe(true)
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

  it("accepts up to 64 characters", () => {
    expect(slotIdSchema.safeParse("a".repeat(64)).success).toBe(true)
    expect(slotIdSchema.safeParse("a".repeat(65)).success).toBe(false)
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
