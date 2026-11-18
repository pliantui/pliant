import { describe, expect, it } from "vitest"

import { identityOf, parentOf } from "./node-identity"

describe("identityOf", () => {
  it.each([
    ["dashboard", "dashboard"],
    ["dashboard/slots/top-row", "top-row"],
    ["page/slots/dashboard/slots/top-row", "top-row"],
    ["orders-table/columns/notes", "orders-table/columns/notes"],
    ["page/slots/orders-table/columns/notes", "orders-table/columns/notes"],
    ["page/slots/table/columns/slots", "table/columns/slots"],
    ["table/columns/slots/fields/f", "table/columns/slots/fields/f"],
    ["order-card[]/actions/refund", "order-card[]/actions/refund"],
    ["@surface", "@surface"],
  ])("reads %s as %s", (address, identity) => {
    expect(identityOf(address)).toBe(identity)
  })
})

describe("parentOf", () => {
  it.each([
    ["dashboard/slots/x", "dashboard"],
    ["page/slots/dashboard/slots/x", "dashboard"],
    ["shell/slots/toolbar/actions/export", "toolbar"],
  ])("reads the parent of %s as %s", (address, parent) => {
    expect(parentOf(address)).toBe(parent)
  })
})
