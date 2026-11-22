import { DemoAskToolbar } from "@/components/demo/demo-ask-toolbar"
import { ReplayNote } from "@/components/demo/replay-note"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { monthlyRevenue, orders, team } from "@/lib/demo/data"
import { company } from "@/lib/demo/schema"
import { getOrderStats } from "@/lib/demo/stats"

import { homeTargets } from "../home-targets"
import { OrdersCardTable } from "./orders-card"
import { RevenueChartCard } from "./revenue-chart-card"
import { SettingsCard } from "./settings-card"
import { ShowcaseCard } from "./showcase-card"
import { WorkspaceSidebar } from "./sidebar-card"
import { StatsCard } from "./stats-card"
import { TicketCard } from "./ticket-card"

const recentOrders = orders
  .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
  .slice(0, 30)

// Live parts of an app for Saffron Supply Co., the company every demo on the
// site uses. Each one reshapes in place. Render it inside the home page's
// `PliantRoot`.
export function Showcase() {
  return (
    <section aria-labelledby="showcase-heading" className="container-wrapper">
      <div className="container flex flex-col gap-4 rounded-2xl bg-muted p-4 sm:gap-6 sm:p-6 dark:bg-muted/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1 text-sm">
            <div>
              <h2 id="showcase-heading" className="inline font-medium">
                Try it
              </h2>
              . Pick a suggestion on a card, or press Point and pick a part of{" "}
              {company.name}&apos;s app.
            </div>
            <ReplayNote className="text-foreground" />
          </div>
          <DemoAskToolbar targets={homeTargets} />
        </div>
        <NotImplementedBanner variant="preview">
          Customized badges and asks marked Scripted preview parts that
          aren&apos;t in Pliant yet. Scripted asks play hand-written answers.
        </NotImplementedBanner>
        <div className="grid min-w-0 items-stretch gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
            <StatsCard stats={getOrderStats(orders)} />
            <TicketCard className="flex-1" />
          </div>
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
            <RevenueChartCard data={monthlyRevenue} />
            <ShowcaseCard
              title="Recent orders"
              description="The latest orders across every region."
              target="orders-table"
              asks={[
                "sort by value, highest first",
                "only show overdue orders",
                "put customer before order",
              ]}
              className="flex-1"
            >
              <OrdersCardTable data={recentOrders} />
            </ShowcaseCard>
          </div>
          <div className="flex min-w-0 flex-col gap-4 sm:gap-6 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
            <ShowcaseCard
              title="Support desk"
              description="The support team's navigation."
              target="workspace-nav"
              asks={["pin customers to the top", "hide reports"]}
            >
              <WorkspaceSidebar
                user={team.find((member) => member.team === "Support")}
              />
            </ShowcaseCard>
            <SettingsCard className="flex-1" />
          </div>
        </div>
      </div>
    </section>
  )
}
