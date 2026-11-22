"use client"

import { ScriptedFrame } from "@/components/demo/scripted-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["history-and-undo"]

const history = [
  { time: "14:05", change: "Filtered to overdue orders" },
  { time: "13:20", change: "Sorted by value, highest first" },
  { time: "9:12", change: "Hid the Notes column" },
]

export function HistoryAndUndoMockup() {
  const scripted = useScriptedAsks()
  const kept = scripted.has(asks.morning)
    ? history.slice(2)
    : scripted.has(asks.undo)
      ? history.slice(1)
      : history

  return (
    <ScriptedFrame
      label="orders table history"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-xl border p-3">
          All orders now:{" "}
          {kept.map((entry) => entry.change.toLowerCase()).join(", ")}
        </p>
        {scripted.has(asks.today) && (
          <ol aria-label="Today's changes" className="flex flex-col gap-1">
            {history.map((entry) => (
              <li key={entry.time} className="flex gap-3">
                <span className="w-12 text-muted-foreground tabular-nums">
                  {entry.time}
                </span>
                <span
                  className={
                    kept.includes(entry)
                      ? ""
                      : "text-muted-foreground line-through"
                  }
                >
                  {entry.change}
                  {!kept.includes(entry) && (
                    <span className="sr-only"> (undone)</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ScriptedFrame>
  )
}
