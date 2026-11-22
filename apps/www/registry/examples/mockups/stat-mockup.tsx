"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "compare with last quarter",
  "show the difference in rupees",
  "show overdue value instead",
]

export function StatMockup() {
  const scripted = useScriptedAsks()
  const overdue = scripted.has(asks[2] ?? "")
  const value = overdue ? "₹4,80,650" : "₹37,76,600"
  const comparison = scripted.has(asks[1] ?? "")
    ? overdue
      ? "₹62,400 more than last quarter"
      : "₹4,12,300 more than last quarter"
    : scripted.has(asks[0] ?? "")
      ? overdue
        ? "+14.9% on last quarter"
        : "+12.3% on last quarter"
      : null

  return (
    <ScriptedFrame label="revenue stat" asks={asks} scripted={scripted}>
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
