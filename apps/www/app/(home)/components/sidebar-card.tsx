"use client"

import {
  ChartColumnIcon,
  InboxIcon,
  SettingsIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { PliantNav } from "@/registry/pliant/pliant-nav"

const items = {
  inbox: { title: "Inbox", url: "/examples/app/inbox", icon: <InboxIcon /> },
  tickets: {
    title: "Tickets",
    url: "/examples/app/tickets",
    icon: <TicketIcon />,
    isActive: true,
  },
  customers: {
    title: "Customers",
    url: "/examples/app/customers",
    icon: <UsersIcon />,
  },
  reports: {
    title: "Reports",
    url: "/examples/app/reports",
    icon: <ChartColumnIcon />,
  },
  settings: {
    title: "Settings",
    url: "/examples/app/settings",
    icon: <SettingsIcon />,
  },
}

// The support desk's sidebar, sized to its card rather than the viewport.
export function WorkspaceSidebar() {
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
      </Sidebar>
    </SidebarProvider>
  )
}
