import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { BlockDisplay } from "@/components/block-display"
import { AnalyticsDashboardDemo } from "@/components/blocks/analytics-dashboard-demo"
import { AppSidebarDemo } from "@/components/blocks/app-sidebar-demo"
import { CrmPipelineDemo } from "@/components/blocks/crm-pipeline-demo"
import { OrdersListDemo } from "@/components/blocks/orders-list-demo"
import { SettingsPageDemo } from "@/components/blocks/settings-page-demo"
import { TeamWorkspaceDemo } from "@/components/blocks/team-workspace-demo"
import { TicketFormDemo } from "@/components/blocks/ticket-form-demo"
import { blocks, type BlockName } from "@/lib/blocks/blocks"
import { deals, monthlyRevenue, orders, team } from "@/lib/demo/data"
import { getOrderStats } from "@/lib/demo/stats"
import { inventory } from "@/lib/pliant/inventory.generated"

export const dynamic = "force-static"
export const revalidate = false

const byNewest = orders.toSorted((a, b) =>
  b.createdAt.localeCompare(a.createdAt)
)

const sales = team.filter((member) => member.team.startsWith("Sales"))

function block(name: BlockName) {
  const found = blocks.find((entry) => entry.name === name)
  if (!found) throw new Error(`No block named ${name}`)
  return found
}

// Each block's live preview, filled with the shared demo company's data.
export default function BlocksPage() {
  const accountManager = sales.find(
    (member) => member.role === "Account manager"
  )
  if (!accountManager) throw new Error("The demo team has no account manager")

  return (
    <PliantRoot
      surface="/blocks"
      storage={localAdapter}
      inventory={inventory["/blocks"]}
    >
      <div className="flex flex-col gap-12 md:gap-24">
        <BlockDisplay block={block("analytics-dashboard")}>
          <AnalyticsDashboardDemo
            stats={getOrderStats(orders)}
            revenue={monthlyRevenue}
          />
        </BlockDisplay>
        <BlockDisplay block={block("orders-list")}>
          <OrdersListDemo data={byNewest.slice(0, 24)} />
        </BlockDisplay>
        <BlockDisplay block={block("ticket-form")}>
          <TicketFormDemo />
        </BlockDisplay>
        <BlockDisplay block={block("settings-page")}>
          <SettingsPageDemo user={accountManager} />
        </BlockDisplay>
        <BlockDisplay block={block("app-sidebar")}>
          <AppSidebarDemo
            user={team.find((member) => member.team === "Support")}
            followUps={byNewest
              .filter((order) => order.status === "overdue")
              .slice(0, 5)}
          />
        </BlockDisplay>
        <BlockDisplay block={block("crm-pipeline")}>
          <CrmPipelineDemo deals={deals} />
        </BlockDisplay>
        <BlockDisplay block={block("team-workspace")}>
          <TeamWorkspaceDemo members={sales} activity={byNewest.slice(0, 5)} />
        </BlockDisplay>
      </div>
    </PliantRoot>
  )
}
