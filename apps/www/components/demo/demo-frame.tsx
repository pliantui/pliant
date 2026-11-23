"use client"

import * as React from "react"
import { cn } from "cn"

import { usePreview } from "@pliantui/react"

import { AskChips } from "@/components/demo/ask-chips"
import {
  actionsOf,
  CustomizeControl,
  CustomizeSurface,
  focusFirstAsk,
  focusTableControls,
} from "@/components/demo/customize-control"
import { DemoAskPanel, useDemoAsk } from "@/components/demo/demo-ask-panel"
import { useDemoCustomize } from "@/components/demo/demo-customize"
import { ReplayNote } from "@/components/demo/replay-note"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { isScriptedAsk } from "@/lib/replay/replay-fetch"
import type { PliantAskTarget } from "@/registry/pliant/pliant-ask-panel"
import {
  PliantPointMode,
  type PliantPointModeHandle,
} from "@/registry/pliant/pliant-point-mode"

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
  // Whether the ask panel's targets can be selected in point mode, which
  // Adjust by hand and holding Alt start.
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
  const customizeButton = React.useRef<HTMLButtonElement>(null)
  const panel = useDemoAsk(askTargets ?? [])
  const pointModeRef = React.useRef<PliantPointModeHandle>(null)
  const selecting = askTargets !== undefined && pointMode
  const customize = useDemoCustomize({
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
  })
  // With point mode, Adjust by hand selects the part, and the selection's
  // bar adjusts it.
  const options = selecting
    ? {
        ...customize,
        onAdjust: () => {
          pointModeRef.current?.start(target)
        },
      }
    : customize
  const previewing = usePreview() !== null && !panel.open

  return (
    <div
      ref={frame}
      // History isn't in the demos yet; its menu item carries the dot.
      data-unfinished="not-implemented"
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        {toolbar}
        <CustomizeControl
          ref={customizeButton}
          label={label}
          previewing={previewing}
          {...options}
        />
        {askTargets && (
          <DemoAskPanel ask={panel} returnFocus={customizeButton} />
        )}
      </div>
      <CustomizeSurface {...options}>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </CustomizeSurface>
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
      {selecting && (
        <PliantPointMode
          ref={pointModeRef}
          targets={askTargets}
          actions={(id) => (id === target ? actionsOf(customize) : undefined)}
        />
      )}
    </div>
  )
}
