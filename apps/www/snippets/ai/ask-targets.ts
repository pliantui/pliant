// #region targets
import type { PliantAskTarget } from "@/components/pliant/pliant-ask-panel"

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
          { id: "overdue", label: "Overdue" },
        ],
      },
    },
    suggestions: ["put the overdue card first", "show the cards in a row"],
  },
  {
    id: "orders-table",
    label: "All orders",
    context: {
      manifest: {
        kind: "data-table",
        version: 1,
        description: "A table of orders",
        capabilities: { data: true, hideable: true, slots: true },
      },
      collection: {
        name: "columns",
        items: [
          { id: "id", label: "Order" },
          { id: "customer", label: "Customer" },
          { id: "status", label: "Status" },
          { id: "value", label: "Value" },
        ],
      },
      fields: [
        { id: "customer", label: "Customer", type: "text" },
        {
          id: "status",
          label: "Status",
          type: "enum",
          values: ["paid", "pending", "overdue", "refunded"],
        },
        { id: "value", label: "Value", type: "number" },
      ],
    },
    suggestions: ["largest orders first", "only overdue orders"],
  },
] satisfies PliantAskTarget[]
// #endregion targets
