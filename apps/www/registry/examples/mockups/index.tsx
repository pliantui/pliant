import { monthlyRevenue, orders } from "@/lib/demo/data"
import type { Order } from "@/lib/demo/schema"

import { ActionsMockup } from "./actions-mockup"
import { ChartMockup } from "./chart-mockup"
import { CustomizedIndicatorMockup } from "./customized-indicator-mockup"
import { DialogMockup } from "./dialog-mockup"
import { HistoryAndUndoMockup } from "./history-and-undo-mockup"
import { ListMockup } from "./list-mockup"
import { MessagesMockup } from "./messages-mockup"
import { ResetMockup } from "./reset-mockup"
import { ShareLinkMockup } from "./share-link-mockup"
import { StatMockup } from "./stat-mockup"
import { SuggestionsMockup } from "./suggestions-mockup"
import { TabsAndPanelsMockup } from "./tabs-and-panels-mockup"
import { TeamPublishMockup } from "./team-publish-mockup"
import { TextSizeDensityMotionMockup } from "./text-size-density-motion-mockup"

function quarter(from: string, to: string) {
  const months = monthlyRevenue.filter(
    ({ month }) => month >= from && month < to
  )
  return {
    revenue: months.reduce((sum, month) => sum + month.paid, 0),
    overdue: months.reduce((sum, month) => sum + month.overdue, 0),
  }
}

// A few orders with some overdue ones in the South, so every ask has
// something to show.
function sampleOrders(count: number): Order[] {
  const overdueSouth = orders
    .filter((order) => order.status === "overdue" && order.region === "South")
    .slice(0, 2)
  const others = orders
    .filter((order) => !overdueSouth.includes(order))
    .slice(0, count - overdueSouth.length)
  return [...others.slice(0, 1), ...overdueSouth, ...others.slice(1)]
}

// The scripted preview of each component that isn't built yet, by page
// slug, filled with the shared demo company's data.
export const mockups = {
  messages: () => <MessagesMockup />,
  chart: () => <ChartMockup data={monthlyRevenue} />,
  stat: () => (
    <StatMockup
      current={quarter("2026-07", "2026-10")}
      previous={quarter("2026-04", "2026-07")}
    />
  ),
  list: () => <ListMockup orders={sampleOrders(6)} />,
  "tabs-and-panels": () => <TabsAndPanelsMockup />,
  actions: () => <ActionsMockup />,
  dialog: () => <DialogMockup />,
  suggestions: () => <SuggestionsMockup orders={sampleOrders(5)} />,
  "customized-indicator": () => <CustomizedIndicatorMockup />,
  reset: () => <ResetMockup />,
  "history-and-undo": () => <HistoryAndUndoMockup />,
  "share-link": () => <ShareLinkMockup />,
  "team-publish": () => <TeamPublishMockup />,
  "text-size-density-motion": () => <TextSizeDensityMotionMockup />,
} satisfies Record<string, () => React.ReactNode>

export type MockupSlug = keyof typeof mockups
