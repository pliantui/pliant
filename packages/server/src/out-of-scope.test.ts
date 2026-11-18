import { describe, expect, it } from "vitest"

import { isOutOfScope } from "./out-of-scope"

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
    expect(isOutOfScope(prompt)).toBe(true)
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
    expect(isOutOfScope(prompt)).toBe(false)
  })
})
