import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"

import { orderRegions, orderStatuses } from "./data"

// The demo route replays recorded answers, so it answers exactly these
// asks; the suggestions list every one of them.

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
          values: [...orderRegions],
        },
        {
          id: "status",
          label: "Status",
          type: "enum",
          values: [...orderStatuses],
        },
        { id: "value", label: "Value", type: "number" },
        { id: "createdAt", label: "Created", type: "date" },
      ],
    },
    suggestions: [
      "sort by value, highest first",
      "hide the notes column",
      "only show overdue orders",
      "put customer before order",
      "pin the order column",
      "make the customer column 240 pixels wide",
      "newest first and hide region",
      "make it nicer",
    ],
  },
] satisfies PliantAskTarget[]
