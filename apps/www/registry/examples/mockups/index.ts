import type { ComponentType } from "react"

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

// The scripted preview of each component that isn't built yet, by page slug.
export const mockups: Record<string, ComponentType> = {
  messages: MessagesMockup,
  chart: ChartMockup,
  stat: StatMockup,
  list: ListMockup,
  "tabs-and-panels": TabsAndPanelsMockup,
  actions: ActionsMockup,
  dialog: DialogMockup,
  suggestions: SuggestionsMockup,
  "customized-indicator": CustomizedIndicatorMockup,
  reset: ResetMockup,
  "history-and-undo": HistoryAndUndoMockup,
  "share-link": ShareLinkMockup,
  "team-publish": TeamPublishMockup,
  "text-size-density-motion": TextSizeDensityMotionMockup,
}
