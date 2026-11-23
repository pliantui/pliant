"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import type { Order, TeamMember } from "@/lib/demo/schema"
import { TeamWorkspace } from "@/registry/blocks/team-workspace/team-workspace"

const publishAsk = "publish this layout for my team"

export function TeamWorkspaceDemo({
  members,
  activity,
}: {
  members: TeamMember[]
  activity: Order[]
}) {
  const scripted = useScriptedAsks()

  return (
    <DemoFrame
      target="team-workspace"
      label="the workspace"
      asks={["put activity first", "hide shared views"]}
      mocked={{
        label: "publishing",
        asks: [publishAsk],
        scripted,
      }}
      className="max-w-none"
    >
      <TeamWorkspace
        members={members}
        activity={activity}
        published={scripted.has(publishAsk)}
      />
    </DemoFrame>
  )
}
