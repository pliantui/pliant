"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Badge } from "@/components/ui/badge"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["team-publish"]

export function TeamPublishMockup() {
  const scripted = useScriptedAsks()
  const removed = scripted.has(asks.remove)
  const everyone = scripted.has(asks.everyone)
  const team = !removed && !everyone && scripted.has(asks.team)

  return (
    <ScriptedFrame
      label="orders layout"
      asks={Object.values(asks)}
      scripted={scripted}
    >
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
