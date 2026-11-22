"use client"

import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarRail,
} from "@/components/ui/sidebar"
import { sections } from "@/registry/blocks/app-sidebar/sections"
import { PliantNav } from "@/registry/pliant/pliant-nav"

export function AppSidebar() {
  const pathname = usePathname()
  const link = (section: keyof typeof sections) => ({
    ...sections[section],
    isActive: pathname === sections[section].url,
  })
  return (
    // Fills the example's height, between the site header and footer,
    // rather than the viewport's.
    <Sidebar collapsible="icon" className="h-auto!">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Support desk</SidebarGroupLabel>
          <nav aria-label="Support desk">
            <PliantNav
              id="app-sidebar"
              items={{
                inbox: link("inbox"),
                tickets: link("tickets"),
                customers: link("customers"),
                reports: link("reports"),
                settings: link("settings"),
              }}
            />
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
