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
]
