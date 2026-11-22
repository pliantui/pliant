import { cn } from "cn"

import { AskChips } from "@/components/demo/ask-chips"
import { CustomizedReset } from "@/components/demo/customized-reset"
import { ReplayNote } from "@/components/demo/replay-note"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { isScriptedAsk } from "@/lib/replay/replay-fetch"

// Frames one live part of an app on a docs page with a Reset and the asks
// that reshape it. Render it inside the demo's `PliantRoot`.
export function DemoFrame({
  target,
  label,
  asks,
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
  // Controls shown beside Reset, like Point and Ask.
  toolbar?: React.ReactNode
  // A part of the demo that isn't built yet: its scripted asks, and what
  // the banner says about it. Reset clears its asks too.
  mocked?:
    | {
        label: string
        asks: readonly string[]
        scripted: ScriptedAsksState
        note: string
      }
    | undefined
  className?: string | undefined
  children: React.ReactNode
}) {
  const scripted = asks.some((ask) => isScriptedAsk(target, ask))
  const recorded = asks.some((ask) => !isScriptedAsk(target, ask))

  return (
    <div
      className={cn("flex w-full max-w-3xl min-w-0 flex-col gap-4", className)}
    >
      <div className="flex items-center justify-end gap-2">
        <CustomizedReset
          targets={[target]}
          label={label}
          scripted={mocked?.scripted}
        />
        {toolbar}
      </div>
      {children}
      <div className="flex flex-col gap-3 border-t pt-4">
        <AskChips target={target} label={label} prompts={asks} />
        {mocked && (
          <ScriptedAsks
            label={mocked.label}
            asks={mocked.asks}
            scripted={mocked.scripted}
          />
        )}
        {recorded && <ReplayNote />}
        <NotImplementedBanner variant="preview">
          The Customized badge previews an indicator that isn&apos;t in Pliant
          yet.
          {(scripted || mocked) &&
            " Asks marked Scripted play hand-written answers instead of recorded ones."}
          {mocked && ` ${mocked.note}`}
        </NotImplementedBanner>
      </div>
    </div>
  )
}
