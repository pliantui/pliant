"use client"

import * as React from "react"

import {
  actionsOf,
  CustomizeSurface,
  focusTableControls,
} from "@/components/demo/customize-control"
import {
  DemoAskContext,
  DemoAskPanel,
  useDemoAsk,
} from "@/components/demo/demo-ask-panel"
import {
  DemoCustomizeMenu,
  useDemoCustomize,
} from "@/components/demo/demo-customize"
import {
  PliantPointMode,
  type PliantPointModeHandle,
} from "@/registry/pliant/pliant-point-mode"

import { askTargets } from "../ask-targets"

// Revenue is the page's headline number, so it can't be hidden.
const flags = { "key-metrics/slots/revenue": { required: true } }

// The orders page's Customize menus and ask panel: one menu for the whole
// page in its header, a right-click Customize group on each part, and the
// panel they open. Adjust by hand, or holding Alt, starts point mode to
// select a part and change it by hand.
export function OrdersDemo({
  header,
  metrics,
  table,
}: {
  header: React.ReactNode
  metrics: React.ReactElement
  table: React.ReactElement
}) {
  const ask = useDemoAsk(askTargets)
  const page = React.useRef<HTMLDivElement>(null)
  const customize = React.useRef<HTMLButtonElement>(null)
  const pointMode = React.useRef<PliantPointModeHandle>(null)
  const metricsCustomize = useDemoCustomize({
    targets: ["key-metrics"],
    onAsk: () => {
      ask.ask("key-metrics")
    },
  })
  const tableCustomize = useDemoCustomize({
    targets: ["orders-table"],
    onAsk: () => {
      ask.ask("orders-table")
    },
    onAdjust: () => {
      focusTableControls(page.current)
    },
  })
  const bar: Record<string, ReturnType<typeof actionsOf>> = {
    "key-metrics": actionsOf(metricsCustomize),
    "orders-table": actionsOf(tableCustomize),
  }

  return (
    <DemoAskContext value={ask}>
      <div ref={page} className="flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          {header}
          <DemoCustomizeMenu
            ref={customize}
            targets={["key-metrics", "orders-table"]}
            label="the orders page"
            commands
            askOpen={ask.open}
            onAsk={() => {
              ask.ask()
            }}
            onAdjust={() => {
              pointMode.current?.start()
            }}
          />
          {/* Next to the menu that opens it, so Tab moves into it. */}
          <DemoAskPanel ask={ask} returnFocus={customize} />
        </header>
        <CustomizeSurface
          {...metricsCustomize}
          onAdjust={() => {
            pointMode.current?.start("key-metrics")
          }}
        >
          {metrics}
        </CustomizeSurface>
        <CustomizeSurface
          {...tableCustomize}
          onAdjust={() => {
            pointMode.current?.start("orders-table")
          }}
        >
          <div>{table}</div>
        </CustomizeSurface>
      </div>
      <PliantPointMode
        ref={pointMode}
        targets={askTargets}
        flags={flags}
        actions={(target) => bar[target]}
      />
    </DemoAskContext>
  )
}
