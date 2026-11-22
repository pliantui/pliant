// #region usage
import {
  PliantAskPanel,
  type PliantAskTarget,
} from "@/components/pliant/pliant-ask-panel"

const targets: PliantAskTarget[] = [
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
          { id: "overdue", label: "Overdue" },
        ],
      },
    },
    suggestions: ["put the overdue card first"],
  },
]

export function AskButton() {
  return <PliantAskPanel endpoint="/api/pliant" targets={targets} />
}
// #endregion usage
