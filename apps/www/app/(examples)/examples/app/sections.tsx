import {
  ChartColumnIcon,
  InboxIcon,
  SettingsIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

export const sections = {
  inbox: { title: "Inbox", url: "/examples/app/inbox", icon: <InboxIcon /> },
  tickets: {
    title: "Tickets",
    url: "/examples/app/tickets",
    icon: <TicketIcon />,
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

export type Section = keyof typeof sections

export function isSection(value: string): value is Section {
  return Object.hasOwn(sections, value)
}
