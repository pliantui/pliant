"use client"

import { AskChips } from "@/components/demo/ask-chips"

import { useShowcaseActivity } from "./showcase-activity"

// A part of the showcase's suggested asks, whose answers change it through
// the layers, so Lock in and Reset work as they do in an app.
export function SurfaceAsks({
  target,
  label,
  prompts,
  more = false,
}: {
  target: string
  label: string
  prompts: readonly string[]
  // Whether these asks follow the part's other asks.
  more?: boolean
}) {
  const { discard } = useShowcaseActivity()
  return (
    <div data-asks-for={more ? undefined : target}>
      <AskChips
        target={target}
        label={label}
        prompts={prompts}
        more={more}
        onDiscard={discard}
      />
    </div>
  )
}
