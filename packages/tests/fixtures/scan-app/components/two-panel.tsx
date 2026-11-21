import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"
import { useTwoRegions } from "@/hooks/use-two-regions"

function Peek({
  region,
  onPick,
}: {
  region?: unknown
  onPick?: () => unknown
}) {
  return <i data-ready={Boolean(region ?? onPick)} />
}

function show(node: React.ReactNode) {
  return node
}

export function TwoPanel() {
  const both = useTwoRegions()
  React.useDebugValue(show)
  return (
    <section>
      <Peek />
      {both.a.entries.map((entry) => (
        <div key={entry.id} />
      ))}
      <PliantRegion id="two-banner" slots={{ notice: <p>Notice</p> }} />
      {both.b.entries.map((entry) => (
        <div key={entry.id} />
      ))}
    </section>
  )
}
