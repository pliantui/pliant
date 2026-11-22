"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { TeamMember } from "@/lib/demo/schema"
import { PliantNav } from "@/registry/pliant/pliant-nav"

import { sections } from "./sections"

const items = {
  ...sections,
  tickets: { ...sections.tickets, isActive: true },
}

// The support desk's sidebar, sized to its card rather than the viewport.
export function WorkspaceSidebar({ user }: { user: TeamMember | undefined }) {
  return (
    <SidebarProvider className="min-h-0">
      <Sidebar
        collapsible="none"
        className="w-full rounded-lg border bg-sidebar"
      >
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Support desk</SidebarGroupLabel>
            <nav aria-label="Support desk">
              <PliantNav id="workspace-nav" items={items} />
            </nav>
          </SidebarGroup>
        </SidebarContent>
        {user && (
          <SidebarFooter className="border-t">
            <div className="flex items-center gap-2 p-1 text-sm">
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-medium"
              >
                {user.name
                  .split(" ")
                  .map((part) => part.charAt(0))
                  .join("")}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.role}
                </span>
              </span>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>
    </SidebarProvider>
  )
}
