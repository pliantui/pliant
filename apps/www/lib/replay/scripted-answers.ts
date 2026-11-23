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
    target: "team-workspace",
    kind: "region",
    prompt: "put activity first",
    ops: [
      {
        op: "move",
        target: "team-workspace/slots/activity",
        to: { index: 0 },
      },
    ],
    explain: ["Moved Activity to the first panel."],
  },
  {
    target: "team-workspace",
    kind: "region",
    prompt: "hide shared views",
    ops: [{ op: "hide", target: "team-workspace/slots/shared-views" }],
    explain: ["Hid the Shared views panel."],
  },
  {
    target: "app-sidebar",
    kind: "nav",
    prompt: "hide customers",
    ops: [{ op: "hide", target: "app-sidebar/items/customers" }],
    explain: ["Hid Customers from the sidebar."],
  },
  {
    target: "app-sidebar",
    kind: "nav",
    prompt: "put settings first",
    ops: [
      {
        op: "move",
        target: "app-sidebar/items/settings",
        to: { index: 0 },
      },
    ],
    explain: ["Moved Settings to the top of the sidebar."],
  },
  {
    target: "crm-pipeline",
    kind: "region",
    prompt: "hide the won column",
    ops: [{ op: "hide", target: "crm-pipeline/slots/won" }],
    explain: ["Hid the Won column."],
  },
  {
    target: "crm-pipeline",
    kind: "region",
    prompt: "put proposal first",
    ops: [
      {
        op: "move",
        target: "crm-pipeline/slots/proposal",
        to: { index: 0 },
      },
    ],
    explain: ["Moved the Proposal column to the start."],
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
    prompt: "show each section's share of all target pages",
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
      "Added a Share of target column: each section's target as a share of all the sections shown.",
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
    prompt: "add a card comparing this month's revenue with last month's",
    ops: [
      {
        op: "insert",
        target: "acme-metrics",
        node: {
          id: "acme-metrics-revenue-comparison",
          kind: "stat",
          dataset: "monthly-figures",
          label: "Revenue vs last month",
        },
        at: { index: 4 },
      },
      {
        op: "configureStat",
        target: "acme-metrics-revenue-comparison",
        metric: "revenue",
        comparison: { metric: "previous-revenue", display: "percent" },
        format: { type: "currency", currency: "USD" },
      },
    ],
    explain: [
      "Added a Revenue vs last month card.",
      "Set the card to this month's revenue, with the change from last month's.",
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
    prompt: "move what I don't use under More",
    ops: [
      {
        op: "collapse",
        target: "acme-nav",
        items: ["projects", "team"],
        into: "more",
      },
    ],
    explain: ["Moved Projects and Team, which you haven't opened, under More."],
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
