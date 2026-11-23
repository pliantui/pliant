"use client"

import * as React from "react"
import { cn } from "cn"

import { AskChips } from "@/components/demo/ask-chips"
import {
  focusFirstAsk,
  focusTableControls,
} from "@/components/demo/customize-control"
import { DemoAskPanel, useDemoAsk } from "@/components/demo/demo-ask-panel"
import {
  DemoCustomizeMenu,
  DemoCustomizeSurface,
} from "@/components/demo/demo-customize"
import { ReplayNote } from "@/components/demo/replay-note"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { isScriptedAsk } from "@/lib/replay/replay-fetch"
import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

// Frames one live part of an app on a docs page with its Customize menu and
// the asks that reshape it. Render it inside the demo's `PliantRoot`.
export function DemoFrame({
  target,
  label,
  asks,
  askTargets,
  adjustable = false,
  pointMode = false,
  toolbar,
  mocked,
  className,
  children,
}: {
  // The node the asks and Reset change.
  target: string
  // The node's name, as the asks and Reset read it, like "key metrics".
  label: string
  asks: readonly string[]
  // The ask panel's targets, when the demo has one: Ask opens it. Without
  // it, Ask moves focus to the suggested asks.
  askTargets?: readonly PliantAskTarget[] | undefined
  // Whether the part has controls to adjust it by hand, such as a table's
  // toolbar or columns menu, which Adjust by hand moves focus to.
  adjustable?: boolean
  // Whether holding Alt points at the ask panel's targets, to ask about the
  // one picked.
  pointMode?: boolean
  // Controls shown beside Customize.
  toolbar?: React.ReactNode
  // A part of the demo that isn't built yet, and its scripted asks. Reset
  // clears its asks too.
  mocked?:
    | {
        label: string
        asks: readonly string[]
        scripted: ScriptedAsksState
      }
    | undefined
  className?: string | undefined
  children: React.ReactNode
}) {
  const recorded = asks.some((ask) => !isScriptedAsk(target, ask))
  const scripted =
    mocked !== undefined || asks.some((ask) => isScriptedAsk(target, ask))
  const frame = React.useRef<HTMLDivElement>(null)
  const customize = React.useRef<HTMLButtonElement>(null)
  const panel = useDemoAsk(askTargets ?? [])
  const options = {
    targets: [target],
    scripted: mocked?.scripted,
    onAsk: () => {
      if (askTargets) panel.ask()
      else focusFirstAsk(frame.current)
    },
    onAdjust: adjustable
      ? () => {
          focusTableControls(frame.current)
        }
      : undefined,
  }

  return (
    <div
      ref={frame}
      // History isn't in the demos yet; its menu item carries the dot.
      data-unfinished="not-implemented"
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        {toolbar}
        <DemoCustomizeMenu ref={customize} label={label} {...options} />
      </div>
      <DemoCustomizeSurface {...options}>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </DemoCustomizeSurface>
      <div className="flex flex-col gap-3 border-t pt-4">
        {mocked && (
          <ScriptedAsks
            label={mocked.label}
            asks={mocked.asks}
            scripted={mocked.scripted}
          />
        )}
        <AskChips target={target} label={label} prompts={asks} />
        {recorded && <ReplayNote scripted={scripted} />}
      </div>
      {askTargets && <DemoAskPanel ask={panel} returnFocus={customize} />}
      {askTargets && pointMode && (
        <PliantPointMode
          targets={askTargets}
          onPick={panel.ask}
          trigger={null}
        />
      )}
    </div>
  )
}
