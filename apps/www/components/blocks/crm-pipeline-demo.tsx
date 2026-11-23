"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import type { Deal } from "@/lib/demo/schema"
import { CrmPipeline } from "@/registry/blocks/crm-pipeline/crm-pipeline"

const viewAsks = {
  totals: "show the total for each stage",
  compact: "make the cards compact",
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
        note: "Stage totals and compact cards are shown by scripted answers.",
      }}
      className="max-w-none"
    >
      <CrmPipeline
        deals={deals}
        view={{
          totals: scripted.has(viewAsks.totals),
          compact: scripted.has(viewAsks.compact),
        }}
      />
    </DemoFrame>
  )
}
