"use client"

import * as React from "react"

import {
  PliantRoot,
  usePliantStore,
  usePliantSurface,
  type Overlay,
} from "@pliantui/react"

import { AskChips } from "@/components/demo/ask-chips"
import { focusFirstAsk } from "@/components/demo/customize-control"
import {
  DemoCustomizeMenu,
  DemoCustomizeSurface,
} from "@/components/demo/demo-customize"
import { ReplayNote } from "@/components/demo/replay-note"
import { ScriptedAnswerLabel } from "@/components/demo/scripted-answer-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { memoryAdapter } from "@/lib/demo/memory-adapter"
import { isScriptedAsk, replayAnswer } from "@/lib/replay/replay-fetch"

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

// Asking in your own words. With no model behind the playground, it
// answers only the example's suggested asks, and keeps each answer at once.
function FreeTextAsk({
  example,
  onLockIn,
}: {
  example: PlaygroundExample
  onLockIn: (overlay: Overlay) => void
}) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const [status, setStatus] = React.useState({ message: "", scripted: false })
  const [draft, setDraft] = React.useState("")

  function ask(prompt: string) {
    const answer = replayAnswer(
      { surface, target: example.target, prompt },
      { scripted: true }
    )
    const scripted = isScriptedAsk(example.target, prompt)
    if (answer.status !== "ok") {
      setStatus({
        message: answer.status === "clarify" ? answer.question : answer.reason,
        scripted,
      })
      return
    }
    const previewed = store.preview(answer.overlay)
    const locked = previewed.success ? store.lockIn() : previewed
    if (!locked.success) {
      store.discard()
      setStatus({
        message: "This change can't be shown right now. Try another ask.",
        scripted: false,
      })
      return
    }
    if (locked.overlay) onLockIn(locked.overlay)
    setStatus({ message: answer.explain.join(" "), scripted })
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (draft.trim()) ask(draft)
      }}
    >
      <Label htmlFor="playground-ask">Or ask in your own words</Label>
      <div className="flex gap-2">
        <Input
          id="playground-ask"
          value={draft}
          placeholder={example.asks[0]}
          autoComplete="off"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
        />
        <Button type="submit" variant="secondary">
          Ask
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground empty:sr-only">
        {status.message && status.scripted && <ScriptedAnswerLabel />}
        {status.message}
      </p>
    </form>
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
  if (!example) return null
  const overlays = changes[example.id] ?? []
  const keep = (overlay: Overlay) => {
    setView("after")
    setChanges((current) => ({
      ...current,
      [example.id]: [...(current[example.id] ?? []), overlay],
    }))
  }
  const customize = {
    targets: [example.target],
    onAsk: () => {
      focusFirstAsk(document.getElementById("main"))
    },
    onReset: () => {
      setChanges((current) => ({ ...current, [example.id]: [] }))
    },
  }

  return (
    <PliantRoot surface="/playground" storage={memoryAdapter()}>
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
                if (!value) return
                setPicked(value)
                setView("after")
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
              onLockIn={keep}
            />
            <FreeTextAsk key={example.id} example={example} onLockIn={keep} />
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
              The playground isn&apos;t connected to a model, so asking in your
              own words answers only the suggested asks.
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
                  if (isView(value)) setView(value)
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
    </PliantRoot>
  )
}
