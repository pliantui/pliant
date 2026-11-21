import { PliantNav } from "@/components/pliant/pliant-nav"

const items = {
  inbox: { title: "Inbox", url: "/inbox" },
  tickets: { title: "Tickets", url: "/tickets" },
  reports: { title: "Reports", url: "/reports" },
}

export function AppSidebar() {
  return (
    <nav aria-label="Main">
      <PliantNav id="app-sidebar" items={items} />
    </nav>
  )
}
