import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"

// The demo route replays recorded answers, so it answers exactly these
// asks; the suggestions list every one of them. The orders table becomes a
// target once it is a Pliant node.

export const askTargets = [
  {
    id: "key-metrics",
    label: "Key metrics",
    context: {
      manifest: {
        kind: "region",
        version: 1,
        description: "A row of key metric cards",
        capabilities: { slots: true, hideable: true, layout: true },
      },
      collection: {
        name: "slots",
        items: [
          { id: "revenue", label: "Revenue" },
          { id: "orders", label: "Orders" },
          { id: "average-order-value", label: "Average order value" },
          { id: "overdue", label: "Overdue" },
        ],
      },
    },
    suggestions: [
      "put the overdue card first",
      "hide the average order value card",
      "show the cards in a two-column grid",
    ],
  },
] satisfies PliantAskTarget[]
