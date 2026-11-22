"use client"

import { ScriptedFrame } from "@/components/demo/scripted-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { mockupAsks } from "@/lib/components/mockup-asks"
import { formatCurrency } from "@/lib/demo/format"

const asks = mockupAsks.stat

interface Quarter {
  revenue: number
  overdue: number
}

// This quarter's figures against the last one, from the shared demo data.
export function StatMockup({
  current,
  previous,
}: {
  current: Quarter
  previous: Quarter
}) {
  const scripted = useScriptedAsks()
  const metric = scripted.has(asks.overdue) ? "overdue" : "revenue"
  const label = metric === "overdue" ? "Overdue value" : "Revenue"
  const difference = current[metric] - previous[metric]
  const change = previous[metric] ? (difference / previous[metric]) * 100 : 0
  const comparison = scripted.has(asks.rupees)
    ? `${formatCurrency(Math.abs(difference))} ${difference >= 0 ? "more" : "less"} than last quarter`
    : scripted.has(asks.compare)
      ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% on last quarter`
      : null

  return (
    <ScriptedFrame
      label="revenue stat"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div
        role="group"
        aria-label={label}
        className="mx-auto flex w-full max-w-xs flex-col gap-1 rounded-xl border p-4"
      >
        <span className="text-sm text-muted-foreground">
          {label}, Jul–Sep 2026
        </span>
        <span className="text-3xl font-semibold tabular-nums">
          {formatCurrency(current[metric])}
        </span>
        {comparison && (
          <span className="text-sm text-muted-foreground">{comparison}</span>
        )}
      </div>
    </ScriptedFrame>
  )
}
