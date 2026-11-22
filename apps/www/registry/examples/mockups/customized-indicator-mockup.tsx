"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Badge } from "@/components/ui/badge"

const asks = [
  "what have i changed here",
  "undo my changes to this table",
  "who set this layout",
]

export function CustomizedIndicatorMockup() {
  const scripted = useScriptedAsks()
  const undone = scripted.has(asks[1] ?? "")

  return (
    <ScriptedFrame label="orders table" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium">All orders</p>
          <Badge variant="secondary">
            {undone ? "Customized by your team" : "Customized by you"}
          </Badge>
        </div>
        {scripted.has(asks[0] ?? "") && !undone && (
          <ul className="list-disc pl-5 text-muted-foreground">
            <li>Sorted by value, highest first</li>
            <li>Hid the Notes column</li>
          </ul>
        )}
        {undone && (
          <p className="text-muted-foreground">
            Your changes are gone. The table shows your team&apos;s layout, and
            the indicator lists only their changes.
          </p>
        )}
        {scripted.has(asks[2] ?? "") && (
          <p className="text-muted-foreground">
            The column order is the Sales North team&apos;s default, set by
            Arjun Mehta on 3 Oct 2026.
          </p>
        )}
      </div>
    </ScriptedFrame>
  )
}
