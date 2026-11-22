import type { Op } from "@pliantui/contract"

// Hand-written answers for asks that have no recording yet. They're kept
// apart from the recordings, never written to `recordings/`, and every ask
// they answer is labelled as scripted wherever it's offered.

export interface ScriptedAnswer {
  target: string
  prompt: string
  ops: Op[]
  explain: string[]
}

export const scriptedAnswers: ScriptedAnswer[] = [
  {
    target: "ticket-form",
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
    prompt: "hide the CC field",
    ops: [{ op: "hide", target: "ticket-form/fields/cc" }],
    explain: ["Hid the CC field."],
  },
  {
    target: "notification-settings",
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
    prompt: "hide product news",
    ops: [{ op: "hide", target: "notification-settings/slots/product-news" }],
    explain: ["Hid the Product news setting."],
  },
  {
    target: "workspace-nav",
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
    prompt: "hide reports",
    ops: [{ op: "hide", target: "workspace-nav/items/reports" }],
    explain: ["Hid Reports from the sidebar."],
  },
]
