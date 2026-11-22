"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Badge } from "@/components/ui/badge"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["customized-indicator"]

export function CustomizedIndicatorMockup() {
  const scripted = useScriptedAsks()
  const undone = scripted.has(asks.undo)

  return (
    <ScriptedFrame
      label="orders table"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium">All orders</p>
          <Badge variant="secondary">
            {undone ? "Customized by your team" : "Customized by you"}
          </Badge>
        </div>
        {scripted.has(asks.list) && !undone && (
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
        {scripted.has(asks.who) && (
          <p className="text-muted-foreground">
            The column order is the Sales North team&apos;s default, set by
            Arjun Mehta on 3 Oct 2026.
          </p>
        )}
      </div>
    </ScriptedFrame>
  )
}
