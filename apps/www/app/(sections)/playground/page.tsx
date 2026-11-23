import { Playground } from "@/components/playground/playground"
import {
  keyMetricsAsks,
  notificationSettingsAsks,
  ordersTableAsks,
  ticketFormAsks,
  workspaceNavAsks,
} from "@/lib/demo/asks"
import { orders, team } from "@/lib/demo/data"
import { getOrderStats } from "@/lib/demo/stats"
import { KeyMetrics } from "@/registry/blocks/analytics-dashboard/key-metrics"
import { WorkspaceSidebar } from "@/registry/blocks/app-sidebar/workspace-sidebar"
import { OrdersList } from "@/registry/blocks/orders-list/orders-list"
import { SettingsPage } from "@/registry/blocks/settings-page/settings-page"
import { TicketForm } from "@/registry/blocks/ticket-form/ticket-form"

export const dynamic = "force-static"
export const revalidate = false

export default function PlaygroundPage() {
  const user = team.find((member) => member.role === "Account manager")
  if (!user) throw new Error("The demo team has no account manager")
  const recent = orders
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12)

  return (
    <Playground
      examples={[
        {
          id: "orders",
          label: "Orders table",
          description: "The latest orders.",
          target: "orders-table",
          asks: ordersTableAsks,
          node: <OrdersList data={recent} />,
        },
        {
          id: "key-metrics",
          label: "Key metrics",
          description: "Four figures, with a recorded answer.",
          target: "key-metrics",
          asks: keyMetricsAsks,
          node: <KeyMetrics stats={getOrderStats(orders)} />,
        },
        {
          id: "ticket-form",
          label: "Ticket form",
          description: "A support form, with scripted answers.",
          target: "ticket-form",
          asks: ticketFormAsks,
          node: <TicketForm />,
        },
        {
          id: "settings",
          label: "Notification settings",
          description: "Email settings, with scripted answers.",
          target: "notification-settings",
          asks: notificationSettingsAsks,
          node: <SettingsPage user={user} teamDefaults={false} />,
        },
        {
          id: "sidebar",
          label: "Sidebar",
          description: "A support desk's links, with scripted answers.",
          target: "workspace-nav",
          asks: workspaceNavAsks,
          node: (
            <WorkspaceSidebar
              user={team.find((member) => member.team === "Support")}
            />
          ),
        },
      ]}
    />
  )
}
