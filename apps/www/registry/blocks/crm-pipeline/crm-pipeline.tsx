import { cn } from "cn"

import { formatCurrency } from "@/lib/demo/format"
import { dealStages, type Deal, type DealStage } from "@/lib/demo/schema"

export interface PipelineView {
  hideWon: boolean
  totals: boolean
  largestFirst: boolean
  compact: boolean
}

const stageNames: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
}

// The sales team's open deals as a board, one column per stage.
export function CrmPipeline({
  deals,
  view,
}: {
  deals: Deal[]
  view: PipelineView
}) {
  const stages = view.hideWon
    ? dealStages.filter((stage) => stage !== "won")
    : dealStages

  return (
    <div
      className={cn(
        "grid gap-4",
        stages.length === 4
          ? "sm:grid-cols-2 xl:grid-cols-4"
          : "sm:grid-cols-2 xl:grid-cols-3"
      )}
    >
      {stages.map((stage) => {
        const inStage = deals
          .filter((deal) => deal.stage === stage)
          .toSorted((a, b) => (view.largestFirst ? b.value - a.value : 0))
        const total = inStage.reduce((sum, deal) => sum + deal.value, 0)
        return (
          <section
            key={stage}
            aria-label={stageNames[stage]}
            className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
          >
            <h3 className="flex items-center justify-between gap-2 px-1 text-sm font-medium">
              <span>
                {stageNames[stage]}{" "}
                <span className="text-muted-foreground tabular-nums">
                  {inStage.length}
                </span>
              </span>
              {view.totals && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(total)}
                </span>
              )}
            </h3>
            <ul
              className={cn("flex flex-col", view.compact ? "gap-1" : "gap-2")}
            >
              {inStage.map((deal) => (
                <li
                  key={deal.id}
                  className={cn(
                    "flex flex-col rounded-lg border bg-background text-sm shadow-xs",
                    view.compact ? "px-2 py-1.5" : "gap-1 p-3"
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">
                      {deal.customer}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums">
                      {formatCurrency(deal.value)}
                    </span>
                  </span>
                  {!view.compact && (
                    <span className="text-xs text-muted-foreground">
                      {deal.owner}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
