// #region usage
import { InboxIcon, TicketIcon, UsersIcon } from "lucide-react"

import {
  PliantNav,
  PliantSidebarProvider,
} from "@/components/pliant/pliant-nav"
import { Sidebar, SidebarContent, SidebarGroup } from "@/components/ui/sidebar"

const items = {
  inbox: { title: "Inbox", url: "/inbox", icon: <InboxIcon /> },
  tickets: { title: "Tickets", url: "/tickets", icon: <TicketIcon /> },
  customers: { title: "Customers", url: "/customers", icon: <UsersIcon /> },
}

export function AppSidebar() {
  return (
    <PliantSidebarProvider id="app-sidebar" defaultOpen>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <nav aria-label="Main">
              <PliantNav id="app-sidebar" items={items} />
            </nav>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </PliantSidebarProvider>
  )
}
// #endregion usage
