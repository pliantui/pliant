"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Badge } from "@/components/ui/badge"

const asks = [
  "publish this for my team",
  "make this the default for everyone",
  "remove the team default",
]

export function TeamPublishMockup() {
  const scripted = useScriptedAsks()
  const removed = scripted.has(asks[2] ?? "")
  const everyone = !removed && scripted.has(asks[1] ?? "")
  const team = !removed && !everyone && scripted.has(asks[0] ?? "")

  return (
    <ScriptedFrame label="orders layout" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium">All orders, as Meera Iyer arranged it</h3>
          {team && <Badge variant="secondary">Default for Sales</Badge>}
          {everyone && <Badge variant="secondary">Default for everyone</Badge>}
        </div>
        <p className="text-muted-foreground">
          {team
            ? "Everyone in Sales now starts from this layout. Their own changes still sit on top."
            : everyone
              ? "Everyone at Saffron Supply Co. now starts from this layout."
              : removed
                ? "The team default is gone. Sales starts from the app's layout again."
                : "Only you see this layout."}
        </p>
      </div>
    </ScriptedFrame>
  )
}
