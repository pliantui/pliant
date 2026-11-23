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
  {
    target: "acme-sections",
    kind: "data-table",
    prompt: "add a column for how far each section is over its limit",
    ops: [
      {
        op: "addDerived",
        target: "acme-sections",
        id: "over-limit",
        label: "Over limit",
        expr: {
          fn: "max2",
          args: [
            { fn: "sub", args: [{ field: "target" }, { field: "limit" }] },
            { value: 0 },
          ],
        },
        format: { type: "number", decimals: 0 },
      },
    ],
    explain: [
      "Added an Over limit column: how many pages each section's target is over its limit, or 0.",
    ],
  },
  {
    target: "acme-sections",
    kind: "data-table",
    prompt: "highlight sections in process that are over their limit",
    ops: [
      {
        op: "addHighlight",
        target: "acme-sections",
        id: "in-process-over-limit",
        when: {
          fn: "and",
          args: [
            { fn: "eq", args: [{ field: "status" }, { value: "In Process" }] },
            { fn: "gt", args: [{ field: "target" }, { field: "limit" }] },
          ],
        },
        tone: "warning",
      },
    ],
    explain: [
      "Highlighted the sections in process whose target is over their limit.",
    ],
  },
  {
    target: "acme-sections",
    kind: "data-table",
    prompt: "group by section type with the average target",
    ops: [
      { op: "setGroupBy", target: "acme-sections", fields: ["type"] },
      {
        op: "addAggregate",
        target: "acme-sections",
        id: "average-target",
        label: "Average target",
        expr: { fn: "mean", args: [{ field: "target" }] },
      },
      {
        op: "addAggregate",
        target: "acme-sections",
        id: "section-count",
        label: "Sections",
        expr: { fn: "count", args: [] },
      },
    ],
    explain: [
      "Grouped the sections by type.",
      "Added each type's average target.",
      "Added each type's number of sections.",
    ],
  },
  {
    target: "acme-sections",
    kind: "data-table",
    prompt: "show each section's share of the total target",
    ops: [
      {
        op: "addDerived",
        target: "acme-sections",
        id: "target-share",
        label: "Share of target",
        expr: { fn: "share", args: [{ field: "target" }] },
        format: { type: "percent", decimals: 1 },
      },
    ],
    explain: [
      "Added a Share of target column: each section's share of the total target.",
    ],
  },
  {
    target: "acme-sections",
    kind: "data-table",
    prompt: "only show Eddie Lake's sections that are in process",
    ops: [
      {
        op: "setFilter",
        target: "acme-sections",
        filter: { field: "reviewer", operator: "eq", value: "Eddie Lake" },
      },
      {
        op: "setFilter",
        target: "acme-sections",
        filter: { field: "status", operator: "eq", value: "In Process" },
      },
    ],
    explain: [
      "Showing only the sections Eddie Lake reviews.",
      "Showing only the sections in process.",
    ],
  },
  {
    target: "acme-metrics",
    kind: "region",
    prompt: "show the cards in two columns",
    ops: [
      { op: "setLayout", target: "acme-metrics", mode: "grid", columns: 2 },
    ],
    explain: ["Laid the metric cards out in two columns."],
  },
  {
    target: "acme-metrics",
    kind: "region",
    prompt: "add a card for revenue per new customer",
    ops: [
      {
        op: "insert",
        target: "acme-metrics",
        node: {
          id: "acme-metrics-revenue-per-customer",
          kind: "stat",
          dataset: "monthly-figures",
          label: "Revenue per New Customer",
        },
        at: { index: 4 },
      },
      {
        op: "configureStat",
        target: "acme-metrics-revenue-per-customer",
        metric: "revenue-per-new-customer",
        comparison: {
          metric: "previous-revenue-per-new-customer",
          display: "percent",
        },
        format: { type: "currency", currency: "USD" },
      },
    ],
    explain: [
      "Added a Revenue per New Customer card.",
      "Set the card to this month's revenue divided by its new customers, with the change from last month.",
    ],
  },
  {
    target: "acme-visitors",
    kind: "chart",
    prompt: "chart visitors by device as a line",
    ops: [
      {
        op: "configureChart",
        target: "acme-visitors",
        type: "line",
        x: "date",
        y: ["desktop", "mobile"],
      },
    ],
    explain: ["Showing desktop and mobile visitors as two lines."],
  },
  {
    target: "acme-visitors",
    kind: "chart",
    prompt: "show mobile's share of visitors over time",
    ops: [
      {
        op: "configureChart",
        target: "acme-visitors",
        type: "area",
        x: "date",
        y: ["desktop", "mobile"],
        stacking: "percent",
      },
    ],
    explain: [
      "Stacked desktop and mobile visitors as a share of each day's total.",
    ],
  },
  {
    target: "acme-nav",
    kind: "nav",
    prompt: "open Analytics when I log in",
    ops: [{ op: "setLanding", target: "acme-nav/items/analytics" }],
    explain: ["Analytics is now your start page."],
  },
  {
    target: "acme-nav",
    kind: "nav",
    prompt: "move Projects and Team under More",
    ops: [
      {
        op: "collapse",
        target: "acme-nav",
        items: ["projects", "team"],
        into: "more",
      },
    ],
    explain: ["Moved Projects and Team under More."],
  },
]

// Hand-written answers that decline an ask Pliant can't do with the data the
// app has, and change nothing.
export const scriptedDeclines: {
  target: string
  prompt: string
  reason: string
}[] = [
  {
    target: "acme-metrics",
    prompt: "add a card for profit margin",
    reason:
      "There's no cost data in this dashboard, so profit margin can't be worked out. Nothing changed.",
  },
]
