"use client"

import * as React from "react"

import { focusTableControls } from "@/components/demo/customize-control"
import {
  DemoAskContext,
  DemoAskPanel,
  useDemoAsk,
} from "@/components/demo/demo-ask-panel"
import {
  DemoCustomizeMenu,
  DemoCustomizeSurface,
} from "@/components/demo/demo-customize"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

import { askTargets } from "../ask-targets"

// The orders page's Customize menus and ask panel: one menu for the whole
// page in its header, a right-click Customize group on each part, and the
// panel they open. Holding Alt points at a part to ask about it.
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
  const adjustTable = () => {
    focusTableControls(page.current)
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
            onAsk={() => {
              ask.ask()
            }}
            onAdjust={adjustTable}
          />
          {/* Next to the menu that opens it, so Tab moves into it. */}
          <DemoAskPanel ask={ask} returnFocus={customize} />
        </header>
        <DemoCustomizeSurface
          targets={["key-metrics"]}
          onAsk={() => {
            ask.ask("key-metrics")
          }}
        >
          {metrics}
        </DemoCustomizeSurface>
        <DemoCustomizeSurface
          targets={["orders-table"]}
          onAsk={() => {
            ask.ask("orders-table")
          }}
          onAdjust={adjustTable}
        >
          <div>{table}</div>
        </DemoCustomizeSurface>
      </div>
      <PliantPointMode targets={askTargets} onPick={ask.ask} trigger={null} />
    </DemoAskContext>
  )
}
