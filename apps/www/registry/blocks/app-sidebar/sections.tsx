import {
  ChartColumnIcon,
  InboxIcon,
  SettingsIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

export const sections = {
  inbox: {
    title: "Inbox",
    url: "/examples/team-workspace/inbox",
    icon: <InboxIcon />,
  },
  tickets: {
    title: "Tickets",
    url: "/examples/team-workspace/tickets",
    icon: <TicketIcon />,
  },
  customers: {
    title: "Customers",
    url: "/examples/team-workspace/customers",
    icon: <UsersIcon />,
  },
  reports: {
    title: "Reports",
    url: "/examples/team-workspace/reports",
    icon: <ChartColumnIcon />,
  },
  settings: {
    title: "Settings",
    url: "/examples/team-workspace/settings",
    icon: <SettingsIcon />,
  },
}

export type Section = keyof typeof sections

export function isSection(value: string): value is Section {
  return Object.hasOwn(sections, value)
}
