"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "put the key metrics back",
  "reset this table",
  "reset the whole page",
]

export function ResetMockup() {
  const scripted = useScriptedAsks()
  const page = scripted.has(asks[2] ?? "")
  const metricsBack = page || scripted.has(asks[0] ?? "")
  const tableBack = page || scripted.has(asks[1] ?? "")
  const metrics = metricsBack
    ? ["Revenue", "Orders", "Average order value", "Overdue"]
    : ["Overdue", "Revenue", "Orders"]

  return (
    <ScriptedFrame label="the demo" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3 text-sm">
        <ul
          aria-label="Key metrics"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {metrics.map((metric) => (
            <li key={metric} className="rounded-xl border p-3">
              {metric}
            </li>
          ))}
        </ul>
        <p className="rounded-xl border p-3">
          All orders:{" "}
          {tableBack
            ? "newest first, every column shown"
            : "largest first, only overdue, Notes hidden"}
        </p>
      </div>
    </ScriptedFrame>
  )
}
