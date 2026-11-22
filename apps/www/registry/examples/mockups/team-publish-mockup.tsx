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
  const everyone = scripted.has(asks[1] ?? "")
  const team = !removed && !everyone && scripted.has(asks[0] ?? "")

  return (
    <ScriptedFrame label="orders layout" asks={asks} scripted={scripted}>
      <div className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">All orders, as Meera Iyer arranged it</p>
          {team && <Badge variant="secondary">Default for Sales North</Badge>}
          {everyone && <Badge variant="secondary">Default for everyone</Badge>}
        </div>
        <p className="text-muted-foreground">
          {team
            ? "Everyone in Sales North now starts from this layout. Their own changes still sit on top."
            : everyone
              ? "Everyone at Saffron Supply Co. now starts from this layout."
              : removed
                ? "The team default is gone. Sales North starts from the app's layout again."
                : "Only you see this layout."}
        </p>
      </div>
    </ScriptedFrame>
  )
}
