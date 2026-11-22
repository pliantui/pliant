import { InboxIcon, TicketIcon, UsersIcon } from "lucide-react"

import type { PliantNavItem } from "@/components/pliant/pliant-nav"

export const items: Record<string, PliantNavItem> = {
  inbox: { title: "Inbox", url: "/inbox", icon: <InboxIcon /> },
  tickets: { title: "Tickets", url: "/tickets", icon: <TicketIcon /> },
  customers: { title: "Customers", url: "/customers", icon: <UsersIcon /> },
}
