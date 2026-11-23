"use client"

import * as React from "react"
import { cn } from "cn"

import { usePreview } from "@pliantui/react"

import { AskChips } from "@/components/demo/ask-chips"
import {
  actionsOf,
  CustomizeControl,
  CustomizeSurface,
  focusTableControls,
} from "@/components/demo/customize-control"
import { DemoAsk, useDemoAsk } from "@/components/demo/demo-ask-panel"
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

type DemoFrameProps = React.ComponentProps<typeof DemoFrameBody>

// Frames one live part of an app on a docs page with its Customize menu,
// the asks that reshape it and the chat its Ask opens. Render it inside the
// demo's `PliantRoot`.
export function DemoFrame(props: DemoFrameProps) {
  return (
    <DemoAsk targets={props.askTargets}>
      <DemoFrameBody {...props} />
    </DemoAsk>
  )
}

function DemoFrameBody({
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
  // The chat's targets that are Pliant nodes, with their context. Without
  // them, the chat offers the frame's part by its suggested asks.
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
  const panel = useDemoAsk()
  const pointModeRef = React.useRef<PliantPointModeHandle>(null)
  const selecting = askTargets !== undefined && pointMode
  const customize = useDemoCustomize({
    targets: [target],
    scripted: mocked?.scripted,
    onAsk: () => {
      panel?.ask(target)
    },
    onAdjust: adjustable
      ? () => {
          focusTableControls(frame.current)
        }
      : undefined,
  })
  // With point mode, Adjust by hand selects a part with slots, whose handles
  // adjust it. A part without them goes straight to its own controls.
  const hasSlots =
    askTargets?.find((item) => item.id === target)?.context.collection?.name ===
    "slots"
  const options =
    selecting && hasSlots
      ? {
          ...customize,
          onAdjust: () => {
            pointModeRef.current?.start(target)
          },
        }
      : customize
  const previewing = usePreview() !== null && !panel?.open

  return (
    <div
      ref={frame}
      // History isn't in the demos yet; its menu item carries the dot.
      data-unfinished="not-implemented"
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        {toolbar}
        <CustomizeControl label={label} previewing={previewing} {...options} />
      </div>
      <CustomizeSurface {...options}>
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </CustomizeSurface>
      <div className="flex flex-col gap-3 border-t pt-4">
        {mocked && (
          <ScriptedAsks
            target={target}
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
