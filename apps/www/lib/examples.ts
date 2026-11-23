// The example apps, in the examples nav's order. Each previews parts that
// aren't in Pliant yet, like the Customized badge.
interface Example {
  name: string
  href: string
  unfinished: boolean
}

export const examples: readonly Example[] = [
  { name: "Orders", href: "/examples/orders", unfinished: true },
  { name: "Tickets", href: "/examples/tickets", unfinished: true },
  { name: "CRM", href: "/examples/crm", unfinished: true },
  { name: "Settings", href: "/examples/settings", unfinished: true },
  {
    name: "Team workspace",
    href: "/examples/team-workspace",
    unfinished: true,
  },
  { name: "Analytics", href: "/examples/analytics", unfinished: true },
]
