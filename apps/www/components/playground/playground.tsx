"use client"

import * as React from "react"

import { PliantRoot, type Overlay, type StorageAdapter } from "@pliantui/react"

import { AskChips } from "@/components/demo/ask-chips"
import { DemoAsk, useDemoAsk } from "@/components/demo/demo-ask-panel"
import {
  DemoCustomizeMenu,
  DemoCustomizeSurface,
} from "@/components/demo/demo-customize"
import { ReplayNote } from "@/components/demo/replay-note"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { memoryAdapter } from "@/lib/demo/memory-adapter"
import { isScriptedAsk } from "@/lib/replay/replay-fetch"

export interface PlaygroundExample {
  id: string
  label: string
  description: string
  // The node the asks change.
  target: string
  asks: readonly string[]
  node: React.ReactNode
}

type View = "after" | "before"

function isView(value: string): value is View {
  return value === "after" || value === "before"
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  const id = `playground-step-${String(number)}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="flex items-center gap-2 text-sm font-medium">
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full bg-muted text-xs tabular-nums"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// A guided way to try Pliant: pick an example, ask for a change, compare
// it with how the example started, see the overlay the answer saved, and
// reset.
export function Playground({
  examples,
}: {
  examples: readonly PlaygroundExample[]
}) {
  const [picked, setPicked] = React.useState(examples[0]?.id)
  const [view, setView] = React.useState<View>("after")
  const [changes, setChanges] = React.useState<Record<string, Overlay[]>>({})
  const example = examples.find((entry) => entry.id === picked) ?? examples[0]
  // Every answer kept, from the suggested asks or the chat, is saved here,
  // and listed under the example it changed.
  const kept = React.useRef<(overlay: Overlay) => void>(() => undefined)
  React.useLayoutEffect(() => {
    kept.current = (overlay) => {
      if (!example) return
      setView("after")
      setChanges((current) => ({
        ...current,
        [example.id]: [...(current[example.id] ?? []), overlay],
      }))
    }
  })
  const [storage] = React.useState(() => (): StorageAdapter => {
    const memory = memoryAdapter()()
    return {
      ...memory,
      save: (surface, overlay, options) => {
        kept.current(overlay)
        return memory.save(surface, overlay, options)
      },
    }
  })
  if (!example) return null

  return (
    <PliantRoot surface="/playground" storage={storage}>
      <DemoAsk>
        <PlaygroundSteps
          examples={examples}
          example={example}
          overlays={changes[example.id] ?? []}
          view={view}
          onPick={(value) => {
            setPicked(value)
            setView("after")
          }}
          onViewChange={setView}
          onReset={() => {
            setChanges((current) => ({ ...current, [example.id]: [] }))
          }}
        />
      </DemoAsk>
    </PliantRoot>
  )
}

function PlaygroundSteps({
  examples,
  example,
  overlays,
  view,
  onPick,
  onViewChange,
  onReset,
}: {
  examples: readonly PlaygroundExample[]
  example: PlaygroundExample
  overlays: readonly Overlay[]
  view: View
  onPick: (id: string) => void
  onViewChange: (view: View) => void
  onReset: () => void
}) {
  const chat = useDemoAsk()
  const customize = {
    targets: [example.target],
    onAsk: () => {
      chat?.ask(example.target)
    },
    onReset,
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[20rem_1fr]">
      <div className="flex min-w-0 flex-col gap-8">
        <Step number={1} title="Pick an example">
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={1}
            aria-label="Examples"
            value={example.id}
            onValueChange={(value) => {
              if (value) onPick(value)
            }}
            className="w-full flex-col items-stretch"
          >
            {examples.map((entry) => (
              <ToggleGroupItem
                key={entry.id}
                value={entry.id}
                className="h-auto flex-col items-start gap-0 bg-background px-3 py-2 text-left whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-background"
              >
                <span className="font-medium">{entry.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {entry.description}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Step>
        <Step number={2} title="Ask for a change">
          <AskChips
            key={example.id}
            target={example.target}
            label={example.label.toLowerCase()}
            prompts={example.asks}
            lockInAtOnce
          />
          {example.asks.some(
            (prompt) => !isScriptedAsk(example.target, prompt)
          ) && (
            <ReplayNote
              scripted={example.asks.some((prompt) =>
                isScriptedAsk(example.target, prompt)
              )}
            />
          )}
          <p className="text-xs text-muted-foreground">
            To ask in your own words, open Customize and choose Ask for a
            change. The playground isn&apos;t connected to a model, so the chat
            answers only the suggested asks.
          </p>
        </Step>
      </div>
      <div className="flex min-w-0 flex-col gap-8">
        <Step number={3} title="Compare before and after">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Show"
              value={view}
              onValueChange={(value) => {
                if (isView(value)) onViewChange(value)
              }}
            >
              <ToggleGroupItem value="after" className="px-3">
                After
              </ToggleGroupItem>
              <ToggleGroupItem value="before" className="px-3">
                Before
              </ToggleGroupItem>
            </ToggleGroup>
            <DemoCustomizeMenu
              {...customize}
              label={example.label.toLowerCase()}
              commands
            />
          </div>
          <div className="min-w-0 rounded-xl border p-4 sm:p-6">
            {view === "after" ? (
              <DemoCustomizeSurface {...customize}>
                <div>{example.node}</div>
              </DemoCustomizeSurface>
            ) : (
              // The untouched example, with layers of its own. Only one copy
              // is mounted at a time, so ids stay unique. The kept answers
              // live in the page's layers, so they come back with "After".
              <div inert>
                <PliantRoot
                  key={example.id}
                  surface="/playground/before"
                  storage={memoryAdapter()}
                >
                  {example.node}
                </PliantRoot>
              </div>
            )}
          </div>
        </Step>
        <Step number={4} title="What changed">
          <p className="text-sm text-muted-foreground">
            Each answer you keep is saved as an overlay: a list of changes
            Pliant applies on top of your app for this user. Here are the
            overlays saved for this example.
          </p>
          <pre
            role="region"
            tabIndex={0}
            aria-label="Overlay JSON"
            className="max-h-96 overflow-auto rounded-lg border bg-code p-4 font-mono text-xs text-code-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {overlays.length === 0
              ? "// No changes yet. Pick an ask to see its overlay."
              : JSON.stringify(
                  overlays.length === 1 ? overlays[0] : overlays,
                  null,
                  2
                )}
          </pre>
        </Step>
      </div>
    </div>
  )
}
