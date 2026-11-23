"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { workspaceNavAsks } from "@/lib/demo/asks"
import type { Order, TeamMember } from "@/lib/demo/schema"
import { AppSidebar } from "@/registry/blocks/app-sidebar/app-sidebar"

export function AppSidebarDemo({
  user,
  followUps,
}: {
  user: TeamMember | undefined
  followUps: Order[]
}) {
  return (
    <DemoFrame
      target="workspace-nav"
      label="the sidebar"
      asks={workspaceNavAsks}
      className="max-w-none"
    >
      <AppSidebar user={user} followUps={followUps} />
    </DemoFrame>
  )
}
