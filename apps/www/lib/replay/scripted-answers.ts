import type { Op } from "@pliantui/contract"

// Hand-written answers for asks that have no recording. They're kept
// apart from the recordings, never written to `recordings/`, and every ask
// they answer is labelled as scripted wherever it's offered.

export interface ScriptedAnswer {
  target: string
  // The manifest kind of the target, for the overlay's basis.
  kind: string
  prompt: string
  ops: Op[]
  explain: string[]
}

export const scriptedAnswers: ScriptedAnswer[] = [
  {
    target: "ticket-form",
    kind: "form",
    prompt: "put priority first",
    ops: [
      {
        op: "move",
        target: "ticket-form/fields/priority",
        to: { index: 0 },
      },
    ],
    explain: ["Moved the Priority field to the top of the form."],
  },
  {
    target: "ticket-form",
    kind: "form",
    prompt: "hide the CC field",
    ops: [{ op: "hide", target: "ticket-form/fields/cc" }],
    explain: ["Hid the CC field."],
  },
  {
    target: "notification-settings",
    kind: "region",
    prompt: "put order alerts first",
    ops: [
      {
        op: "move",
        target: "notification-settings/slots/order-alerts",
        to: { index: 0 },
      },
    ],
    explain: ["Moved Order alerts to the top."],
  },
  {
    target: "notification-settings",
    kind: "region",
    prompt: "hide product news",
    ops: [{ op: "hide", target: "notification-settings/slots/product-news" }],
    explain: ["Hid the Product news setting."],
  },
  {
    target: "workspace-nav",
    kind: "nav",
    prompt: "pin customers to the top",
    ops: [
      {
        op: "move",
        target: "workspace-nav/items/customers",
        to: { index: 0 },
      },
    ],
    explain: ["Moved Customers to the top of the sidebar."],
  },
  {
    target: "workspace-nav",
    kind: "nav",
    prompt: "hide reports",
    ops: [{ op: "hide", target: "workspace-nav/items/reports" }],
    explain: ["Hid Reports from the sidebar."],
  },
  {
    target: "orders-table",
    kind: "data-table",
    prompt: "add a column for days since each order was placed",
    ops: [
      {
        op: "addDerived",
        target: "orders-table",
        id: "days-since-order",
        label: "Days since order",
        expr: {
          fn: "dateDiff",
          args: [
            { field: "createdAt" },
            { fn: "today", args: [] },
            { value: "days" },
          ],
        },
        format: { type: "number", decimals: 0 },
      },
    ],
    explain: ["Added a Days since order column."],
  },
  {
    target: "orders-table",
    kind: "data-table",
    prompt: "highlight overdue orders over ₹1L",
    ops: [
      {
        op: "addHighlight",
        target: "orders-table",
        id: "large-overdue",
        when: {
          fn: "and",
          args: [
            { fn: "eq", args: [{ field: "status" }, { value: "overdue" }] },
            { fn: "gt", args: [{ field: "value" }, { value: 100000 }] },
          ],
        },
        tone: "danger",
      },
    ],
    explain: ["Highlighted the overdue orders worth more than ₹1,00,000."],
  },
  {
    target: "orders-table",
    kind: "data-table",
    prompt: "show each order's share of total value",
    ops: [
      {
        op: "addDerived",
        target: "orders-table",
        id: "value-share",
        label: "Share of value",
        expr: { fn: "share", args: [{ field: "value" }] },
        format: { type: "percent", decimals: 1 },
      },
    ],
    explain: ["Added a Share of value column."],
  },
  {
    target: "orders-table",
    kind: "data-table",
    prompt: "group by region with average order value and std dev",
    ops: [
      { op: "setGroupBy", target: "orders-table", fields: ["region"] },
      {
        op: "addAggregate",
        target: "orders-table",
        id: "average-value",
        label: "Average value",
        expr: { fn: "mean", args: [{ field: "value" }] },
      },
      {
        op: "addAggregate",
        target: "orders-table",
        id: "value-std-dev",
        label: "Std dev",
        expr: { fn: "stddev", args: [{ field: "value" }] },
      },
    ],
    explain: [
      "Grouped the orders by region.",
      "Added each region's average order value.",
      "Added the standard deviation of each region's order values.",
    ],
  },
  {
    target: "orders-table",
    kind: "data-table",
    prompt: "add a running total of order value",
    ops: [
      {
        op: "addDerived",
        target: "orders-table",
        id: "running-total",
        label: "Running total",
        expr: { fn: "runningSum", args: [{ field: "value" }] },
      },
    ],
    explain: ["Added a Running total column, in the table's order."],
  },
  {
    target: "key-metrics",
    kind: "region",
    prompt: "add a card for this quarter's refund rate",
    ops: [
      {
        op: "insert",
        target: "key-metrics",
        node: {
          id: "key-metrics-refund-rate",
          kind: "stat",
          dataset: "orders",
          label: "Refund rate this quarter",
        },
        at: { index: 4 },
      },
      {
        op: "configureStat",
        target: "key-metrics-refund-rate",
        metric: "refund-rate",
        format: { type: "percent", decimals: 1 },
      },
    ],
    explain: [
      "Added a Refund rate this quarter card.",
      "Set the card to the share of this quarter's orders that were refunded.",
    ],
  },
  {
    target: "workspace-nav",
    kind: "nav",
    prompt: "open Tickets when I log in",
    ops: [{ op: "setLanding", target: "workspace-nav/items/tickets" }],
    explain: ["Tickets is now your start page."],
  },
  {
    target: "workspace-nav",
    kind: "nav",
    prompt: "move Reports and Settings under More",
    ops: [
      {
        op: "collapse",
        target: "workspace-nav",
        items: ["reports", "settings"],
        into: "more",
      },
    ],
    explain: ["Moved Reports and Settings under More."],
  },
  {
    target: "app-sidebar",
    kind: "nav",
    prompt: "open Tickets when I log in",
    ops: [{ op: "setLanding", target: "app-sidebar/items/tickets" }],
    explain: ["Tickets is now your start page."],
  },
  {
    target: "app-sidebar",
    kind: "nav",
    prompt: "move Reports and Settings under More",
    ops: [
      {
        op: "collapse",
        target: "app-sidebar",
        items: ["reports", "settings"],
        into: "more",
      },
    ],
    explain: ["Moved Reports and Settings under More."],
  },
  {
    target: "ticket-form",
    kind: "form",
    prompt: "default priority to High for me",
    ops: [
      {
        op: "setDefault",
        target: "ticket-form/fields/priority",
        value: "high",
      },
    ],
    explain: ["New tickets now start with High priority for you."],
  },
  {
    target: "ticket-form",
    kind: "form",
    prompt: "fold the order number and CC into More fields",
    ops: [
      {
        op: "collapse",
        target: "ticket-form",
        items: ["orderId", "cc"],
        into: "more",
        label: "More fields",
      },
    ],
    explain: ["Folded Order number and CC into More fields."],
  },
  {
    target: "notification-settings",
    kind: "region",
    prompt: "fold product news and the weekly report under More",
    ops: [
      {
        op: "collapse",
        target: "notification-settings",
        items: ["product-news", "weekly-report"],
        into: "more",
      },
    ],
    explain: ["Moved Product news and Weekly report under More."],
  },
  {
    target: "crm-pipeline",
    kind: "region",
    prompt: "show the stages in two columns",
    ops: [
      { op: "setLayout", target: "crm-pipeline", mode: "grid", columns: 2 },
    ],
    explain: ["Laid the stages out in two columns."],
  },
  {
    target: "team-workspace",
    kind: "region",
    prompt: "show the panels in one column",
    ops: [{ op: "setLayout", target: "team-workspace", mode: "stack" }],
    explain: ["Stacked the panels in one column."],
  },
]
