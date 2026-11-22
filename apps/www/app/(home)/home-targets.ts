import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"

import { askTargets } from "../(examples)/examples/orders/ask-targets"

// The parts of the showcase the ask panel can change. The key metrics and
// the orders table share the orders example's context, so their recorded
// answers replay here too; the others answer only their scripted asks,
// which their cards offer and label.
export const homeTargets: readonly PliantAskTarget[] = [
  ...askTargets,
  {
    id: "notification-settings",
    label: "Notifications",
    context: {
      manifest: {
        kind: "region",
        version: 1,
        description: "A list of notification settings",
        capabilities: { slots: true, hideable: true, layout: true },
      },
      collection: {
        name: "slots",
        items: [
          { id: "order-confirmations", label: "Order confirmations" },
          { id: "order-alerts", label: "Order alerts" },
          { id: "weekly-report", label: "Weekly report" },
          { id: "product-news", label: "Product news" },
        ],
      },
    },
  },
  {
    id: "ticket-form",
    label: "New ticket",
    context: {
      manifest: {
        kind: "form",
        version: 1,
        description: "A form for a new support ticket",
        capabilities: { form: true, hideable: true },
      },
    },
  },
  {
    id: "workspace-nav",
    label: "Support desk sidebar",
    context: {
      manifest: {
        kind: "nav",
        version: 1,
        description: "The support desk's sidebar links",
        capabilities: { nav: true, hideable: true },
      },
    },
  },
]
