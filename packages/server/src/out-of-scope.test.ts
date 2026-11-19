import { describe, expect, it } from "vitest"

import type { AskContext } from "./ask-request"
import { isOutOfScope } from "./out-of-scope"

const empty: AskContext = {
  manifest: {
    kind: "data-table",
    version: 1,
    description: "A table of customers",
    capabilities: { data: true },
  },
}

const customers: AskContext = {
  ...empty,
  collection: {
    name: "columns",
    items: [
      { id: "name", label: "Name" },
      { id: "contactEmail", label: "Email" },
    ],
  },
  fields: [{ id: "refund", label: "Refund   due", type: "number" }],
}

const orders: AskContext = {
  ...empty,
  collection: {
    name: "columns",
    items: [
      { id: "customer", label: "Customer" },
      { id: "region", label: "Region" },
    ],
  },
}

const metrics: AskContext = {
  ...empty,
  collection: {
    name: "slots",
    items: [
      { id: "orders", label: "Orders" },
      { id: "overdue", label: "Overdue" },
    ],
  },
}

describe("isOutOfScope", () => {
  it.each([
    "delete the cancelled orders",
    "Delete all refunded orders",
    "please email this customer",
    "Can you e-mail the invoice to Bharat Foods",
    "refund order 1042",
    "  Approve   the overdue orders",
    "charge the pending customers",
  ])("catches %j", (prompt) => {
    expect(isOutOfScope(prompt, empty)).toBe(true)
  })

  it.each([
    "delete the notes column",
    "remove the filter",
    "remove the overdue card",
    "cancel the sort",
    "send the notes column to the end",
    "sort by value",
    "hide notes",
    "make the text bigger",
    "show only overdue orders",
    "I want to see newest first",
    "deleted orders first",
    "call this column Total",
    "edit the column labels",
    "restore defaults",
    "restore the original order",
    "update it to show newest first",
    "send overdue to the top",
    "cancel that",
    "notify me about overdue orders",
  ])("leaves %j to the model", (prompt) => {
    expect(isOutOfScope(prompt, empty)).toBe(false)
  })

  it.each([
    "email to the front",
    "Email first",
    "refund first",
    "refund due, highest first",
    "Refund Due on the left",
  ])("leaves %j to the model when it names an item or field", (prompt) => {
    expect(isOutOfScope(prompt, empty)).toBe(true)
    expect(isOutOfScope(prompt, customers)).toBe(false)
  })

  it.each<[string, AskContext]>([
    ["email this customer", orders],
    ["please delete the region", orders],
    ["delete the cancelled orders", metrics],
    ["approve the overdue orders", metrics],
  ])(
    "catches %j when an item or field is only its object",
    (prompt, context) => {
      expect(isOutOfScope(prompt, context)).toBe(true)
    }
  )
})
