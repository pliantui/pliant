"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
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
      asks={["pin customers to the top", "hide reports"]}
      className="max-w-none"
    >
      <AppSidebar user={user} followUps={followUps} />
    </DemoFrame>
  )
}
