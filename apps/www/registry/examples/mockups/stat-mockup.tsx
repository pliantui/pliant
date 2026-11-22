"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks.stat

export function StatMockup() {
  const scripted = useScriptedAsks()
  const overdue = scripted.has(asks.overdue)
  const value = overdue ? "₹4,80,650" : "₹37,76,600"
  const comparison = scripted.has(asks.rupees)
    ? overdue
      ? "₹62,400 more than last quarter"
      : "₹4,12,300 more than last quarter"
    : scripted.has(asks.compare)
      ? overdue
        ? "+14.9% on last quarter"
        : "+12.3% on last quarter"
      : null

  return (
    <ScriptedFrame
      label="revenue stat"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div
        role="group"
        aria-label={overdue ? "Overdue value" : "Revenue"}
        className="mx-auto flex w-full max-w-xs flex-col gap-1 rounded-xl border p-4"
      >
        <span className="text-sm text-muted-foreground">
          {overdue ? "Overdue value" : "Revenue"}
        </span>
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {comparison && (
          <span className="text-sm text-muted-foreground">{comparison}</span>
        )}
      </div>
    </ScriptedFrame>
  )
}
