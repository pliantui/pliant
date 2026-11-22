import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"

import { askTargets } from "../(examples)/examples/orders/ask-targets"

// The parts of the showcase the ask panel and point mode can change: the
// ones with recorded answers. They share the orders example's context, so
// its recordings replay here. The other cards offer only their scripted
// asks, as labelled chips.
export const homeTargets: readonly PliantAskTarget[] = askTargets.map(
  (target) =>
    target.id === "orders-table"
      ? { ...target, label: "Recent orders" }
      : {
          ...target,
          // The showcase already lays the cards out in two columns.
          suggestions: target.suggestions.filter(
            (suggestion) => suggestion !== "show the cards in a two-column grid"
          ),
        }
)
