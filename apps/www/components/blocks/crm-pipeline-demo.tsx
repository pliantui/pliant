"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import type { Deal } from "@/lib/demo/schema"
import { CrmPipeline } from "@/registry/blocks/crm-pipeline/crm-pipeline"

const viewAsks = {
  stale: "flag deals with no activity in 14 days",
  totals: "show the total for each stage",
}

const dayInMs = 24 * 60 * 60 * 1000

// The demo's data stops on its latest activity, so the 14 days count back
// from that day rather than from today.
function staleBefore(deals: Deal[]) {
  const latest = deals.reduce(
    (last, deal) => (deal.lastActivityAt > last ? deal.lastActivityAt : last),
    ""
  )
  if (!latest) return null
  return new Date(Date.parse(latest) - 13 * dayInMs).toISOString().slice(0, 10)
}

export function CrmPipelineDemo({ deals }: { deals: Deal[] }) {
  const scripted = useScriptedAsks()

  return (
    <DemoFrame
      target="crm-pipeline"
      label="the pipeline"
      asks={["show the stages in two columns"]}
      mocked={{
        label: "the cards",
        asks: Object.values(viewAsks),
        scripted,
      }}
      className="max-w-none"
    >
      <CrmPipeline
        deals={deals}
        view={{
          totals: scripted.has(viewAsks.totals),
          staleBefore: scripted.has(viewAsks.stale) ? staleBefore(deals) : null,
        }}
      />
    </DemoFrame>
  )
}
