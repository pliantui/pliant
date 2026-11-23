// The suggested asks each kind of demo surface offers, shared by the
// blocks, examples, docs previews and the playground. They lead with
// changes nobody would build ahead of time, offer at most one layout
// change, and each maps to ops Pliant can apply.

export const ordersTableAsks = [
  "add a column for days since each order was placed",
  "highlight overdue orders over ₹1L",
  "show each order's share of total value",
  "group by region with average order value and std dev",
  "add a running total of order value",
  "make the customer column 240 pixels wide",
] as const

export const keyMetricsAsks = ["show the cards in a two-column grid"] as const

export const refundRateAsk = "add a card for this quarter's refund rate"

export const workspaceNavAsks = [
  "open Tickets when I log in",
  "move Reports and Settings under More",
] as const

export const ticketFormAsks = [
  "default priority to High for me",
  "fold the order number and CC into More fields",
] as const

export const notificationSettingsAsks = [
  "fold product news and the weekly report under More",
] as const
