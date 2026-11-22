"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "undo that",
  "go back to how it was this morning",
  "what did i change today",
]

const history = [
  { time: "9:12", change: "Hid the Notes column" },
  { time: "11:40", change: "Sorted by value, highest first" },
  { time: "14:05", change: "Filtered to overdue orders" },
]

export function HistoryAndUndoMockup() {
  const scripted = useScriptedAsks()
  const kept = scripted.has(asks[1] ?? "")
    ? []
    : scripted.has(asks[0] ?? "")
      ? history.slice(0, -1)
      : history

  return (
    <ScriptedFrame label="orders table history" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-xl border p-3">
          All orders now:{" "}
          {kept.length === 0
            ? "as it was this morning"
            : kept.map((entry) => entry.change.toLowerCase()).join(", ")}
        </p>
        {scripted.has(asks[2] ?? "") && (
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
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </ScriptedFrame>
  )
}
