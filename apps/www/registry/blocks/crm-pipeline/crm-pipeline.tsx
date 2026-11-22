import { cn } from "cn"

import { formatCurrency } from "@/lib/demo/format"
import type { Deal, DealStage } from "@/lib/demo/schema"
import { PliantRegion } from "@/registry/pliant/pliant-region"

export interface PipelineView {
  // Whether each column shows the value of its deals.
  totals: boolean
  compact: boolean
}

const stageNames: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
}

function Stage({
  stage,
  deals,
  view,
}: {
  stage: DealStage
  deals: Deal[]
  view: PipelineView
}) {
  const inStage = deals.filter((deal) => deal.stage === stage)
  const total = inStage.reduce((sum, deal) => sum + deal.value, 0)

  return (
    <section
      aria-label={stageNames[stage]}
      className="flex h-full min-w-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
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
      <ul className={cn("flex flex-col", view.compact ? "gap-1" : "gap-2")}>
        {inStage.map((deal) => (
          <li
            key={deal.id}
            className={cn(
              "flex flex-col rounded-lg border bg-background text-sm shadow-xs",
              view.compact ? "px-2 py-1.5" : "gap-1 p-3"
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{deal.customer}</span>
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
}

// The sales team's open deals as a board, one column per stage. Users can
// reorder and hide the columns.
export function CrmPipeline({
  deals,
  view,
}: {
  deals: Deal[]
  view: PipelineView
}) {
  return (
    <PliantRegion
      id="crm-pipeline"
      className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4"
      slots={{
        lead: <Stage stage="lead" deals={deals} view={view} />,
        qualified: <Stage stage="qualified" deals={deals} view={view} />,
        proposal: <Stage stage="proposal" deals={deals} view={view} />,
        won: <Stage stage="won" deals={deals} view={view} />,
      }}
    />
  )
}
