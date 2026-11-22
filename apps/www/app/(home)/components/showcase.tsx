import { DemoAskToolbar } from "@/components/demo/demo-ask-toolbar"
import { ReplayNote } from "@/components/demo/replay-note"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { monthlyRevenue, orders } from "@/lib/demo/data"
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
    <>
      <section aria-labelledby="showcase-heading" className="container-wrapper">
        <div className="container flex flex-col gap-4 pb-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <h2
                id="showcase-heading"
                className="text-lg font-semibold tracking-tight"
              >
                Try it
              </h2>
              <p className="text-sm text-muted-foreground">
                Parts of the app {company.name} runs on. Pick an ask on a card,
                or press Point and choose a part to change.
              </p>
            </div>
            <DemoAskToolbar targets={homeTargets} />
          </div>
          <ReplayNote />
          <NotImplementedBanner variant="preview">
            The Customized badges preview an indicator that isn&apos;t in Pliant
            yet, and asks marked Scripted play written answers in place of
            recorded ones.
          </NotImplementedBanner>
        </div>
      </section>
      <div className="container-wrapper">
        <div className="container rounded-2xl bg-muted p-4 sm:p-6 dark:bg-muted/40">
          <div className="grid min-w-0 items-start gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
              <StatsCard stats={getOrderStats(orders)} />
              <SettingsCard />
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
              >
                <OrdersCardTable data={recentOrders} />
              </ShowcaseCard>
            </div>
            <div className="flex min-w-0 flex-col gap-4 sm:gap-6 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
              <ShowcaseCard
                title="Sidebar"
                description="The support desk's navigation."
                target="workspace-nav"
                asks={["pin customers to the top", "hide reports"]}
              >
                <WorkspaceSidebar />
              </ShowcaseCard>
              <TicketCard />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
