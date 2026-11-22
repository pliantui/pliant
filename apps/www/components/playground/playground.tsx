"use client"

import * as React from "react"
import { SparklesIcon } from "lucide-react"

import { PliantRoot, usePliantStore, usePliantSurface } from "@pliantui/react"

import { CustomizedReset } from "@/components/demo/customized-reset"
import { ReplayNote } from "@/components/demo/replay-note"
import { ScriptedBadge } from "@/components/demo/scripted-badge"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

// The asks for the picked example, and a box to ask in your own words.
// Each answer is locked in at once, so the before and after can be compared.
function Asks({
  example,
  onChange,
}: {
  example: PlaygroundExample
  onChange: (overlay: unknown) => void
}) {
  const store = usePliantStore()
  const surface = usePliantSurface()
  const [message, setMessage] = React.useState("")
  const [draft, setDraft] = React.useState("")

  function ask(prompt: string) {
    const answer = replayAnswer(
      { surface, target: example.target, prompt },
      { scripted: true }
    )
    if (answer.status !== "ok") {
      setMessage(answer.status === "clarify" ? answer.question : answer.reason)
      return
    }
    const previewed = store.preview(answer.overlay)
    const locked = previewed.success ? store.lockIn() : previewed
    if (!locked.success) {
      store.discard()
      setMessage("This change can't be shown right now. Try another ask.")
      return
    }
    onChange(answer.overlay)
    setMessage(answer.explain.join(" "))
  }

  return (
    <>
      <Step number={2} title="Ask for a change">
        <div
          role="group"
          aria-label={`Ask about ${example.label.toLowerCase()}`}
          className="flex flex-wrap gap-1.5"
          data-unfinished={
            example.asks.some((prompt) => isScriptedAsk(example.target, prompt))
              ? "scripted"
              : undefined
          }
        >
          {example.asks.map((prompt) => {
            const scripted = isScriptedAsk(example.target, prompt)
            return (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-full px-2.5 text-xs font-normal"
                onClick={() => {
                  ask(prompt)
                }}
              >
                {!scripted && <SparklesIcon className="size-3" />}
                {prompt}
                {scripted && <ScriptedBadge />}
              </Button>
            )
          })}
        </div>
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
              placeholder="hide the region column"
              autoComplete="off"
              onChange={(event) => {
                setDraft(event.target.value)
              }}
            />
            <Button type="submit" variant="secondary">
              Ask
            </Button>
          </div>
        </form>
        <p
          role="status"
          className="text-sm text-muted-foreground empty:sr-only"
        >
          {message}
        </p>
        {example.asks.some(
          (prompt) => !isScriptedAsk(example.target, prompt)
        ) && <ReplayNote />}
        <NotImplementedBanner variant="preview">
          The playground isn&apos;t connected to a model, so asking in your own
          words answers only the suggested asks. Asks marked Scripted play
          hand-written answers.
        </NotImplementedBanner>
      </Step>
    </>
  )
}

// A guided way to try Pliant: pick an example, ask for a change, compare
// it with how the example started, see the overlay the answer made, and
// reset.
export function Playground({
  examples,
}: {
  examples: readonly PlaygroundExample[]
}) {
  const [picked, setPicked] = React.useState(examples[0]?.id)
  const [view, setView] = React.useState<View>("after")
  const [changes, setChanges] = React.useState<Record<string, unknown[]>>({})
  const example = examples.find((entry) => entry.id === picked) ?? examples[0]
  if (!example) return null
  const overlays = changes[example.id] ?? []

  return (
    <PliantRoot surface="/playground" storage={memoryAdapter()}>
      <div className="grid min-w-0 gap-8 lg:grid-cols-[20rem_1fr]">
        <div className="flex min-w-0 flex-col gap-8">
          <Step number={1} title="Pick an example">
            <div
              role="group"
              aria-label="Examples"
              className="flex flex-col gap-1"
            >
              {examples.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={entry.id === example.id}
                  className="flex flex-col rounded-lg border bg-background px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary aria-pressed:hover:bg-background"
                  onClick={() => {
                    setPicked(entry.id)
                    setView("after")
                  }}
                >
                  <span className="font-medium">{entry.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.description}
                  </span>
                </button>
              ))}
            </div>
          </Step>
          <Asks
            key={example.id}
            example={example}
            onChange={(overlay) => {
              setView("after")
              setChanges((current) => ({
                ...current,
                [example.id]: [...(current[example.id] ?? []), overlay],
              }))
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <Step number={3} title="Compare before and after">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Show"
                className="inline-flex rounded-lg bg-muted p-1"
              >
                {(["after", "before"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={view === value}
                    className="h-7 px-3 text-xs capitalize aria-pressed:bg-background aria-pressed:shadow-sm"
                    onClick={() => {
                      setView(value)
                    }}
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <CustomizedReset
                targets={[example.target]}
                label={example.label.toLowerCase()}
                onReset={() => {
                  setChanges((current) => ({ ...current, [example.id]: [] }))
                }}
              />
            </div>
            <div className="min-w-0 rounded-xl border p-4 sm:p-6">
              <div hidden={view !== "after"}>{example.node}</div>
              {/* The untouched example, with layers of its own. It comes
                  after the live one, so the live one's labels win. */}
              <div hidden={view !== "before"} inert>
                <PliantRoot
                  key={example.id}
                  surface="/playground/before"
                  storage={memoryAdapter()}
                >
                  {example.node}
                </PliantRoot>
              </div>
            </div>
          </Step>
          <Step number={4} title="What changed">
            <p className="text-sm text-muted-foreground">
              Each answer is an overlay: a list of changes Pliant applies on top
              of your app, saved for this user.
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
