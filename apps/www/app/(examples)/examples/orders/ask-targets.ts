import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"

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
  },
  {
    id: "orders-table",
    label: "Orders table",
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
          { id: "region", label: "Region" },
          { id: "status", label: "Status" },
          { id: "value", label: "Value" },
          { id: "createdAt", label: "Created" },
          { id: "notes", label: "Notes" },
        ],
      },
      fields: [
        { id: "id", label: "Order", type: "text" },
        { id: "customer", label: "Customer", type: "text" },
        {
          id: "region",
          label: "Region",
          type: "enum",
          values: ["North", "South", "East", "West"],
        },
        {
          id: "status",
          label: "Status",
          type: "enum",
          values: ["paid", "pending", "overdue", "refunded"],
        },
        { id: "value", label: "Value", type: "number" },
        { id: "createdAt", label: "Created", type: "date" },
      ],
    },
  },
] satisfies PliantAskTarget[]
