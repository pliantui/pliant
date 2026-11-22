"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import type { Deal } from "@/lib/demo/schema"
import { CrmPipeline } from "@/registry/blocks/crm-pipeline/crm-pipeline"

const asks = {
  hideWon: "hide the won column",
  totals: "show the total for each stage",
  largestFirst: "largest deals first",
  compact: "make the cards compact",
}

export function CrmPipelineDemo({ deals }: { deals: Deal[] }) {
  const scripted = useScriptedAsks()

  return (
    <ScriptedFrame
      label="the pipeline"
      asks={Object.values(asks)}
      scripted={scripted}
      className="max-w-none"
    >
      <CrmPipeline
        deals={deals}
        view={{
          hideWon: scripted.has(asks.hideWon),
          totals: scripted.has(asks.totals),
          largestFirst: scripted.has(asks.largestFirst),
          compact: scripted.has(asks.compact),
        }}
      />
    </ScriptedFrame>
  )
}
