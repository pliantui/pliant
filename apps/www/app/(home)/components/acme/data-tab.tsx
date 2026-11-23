"use client"

import type { CompiledQuery } from "@pliantui/server/sql"

import { Badge } from "@/components/ui/badge"
import { apiCalls } from "@/lib/acme/api"

import { useShowcaseActivity, type ShowcaseChange } from "./showcase-activity"

export interface ShowcaseQueries {
  asks: { filters: unknown[]; query: CompiledQuery }[]
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {/* Focusable, so it scrolls from the keyboard. */}
      <pre
        role="region"
        tabIndex={0}
        aria-label={label}
        className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function Query({ query }: { query: CompiledQuery }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <pre
        role="region"
        tabIndex={0}
        aria-label="Query"
        className="overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {query.text}
      </pre>
      <p className="font-mono text-xs text-muted-foreground">
        values: {JSON.stringify(query.values)}
      </p>
    </div>
  )
}

function opsOf(change: ShowcaseChange): unknown[] {
  const ops = change.overlay["ops"]
  return Array.isArray(ops) ? ops : []
}

function filtersOf(ops: unknown[]) {
  return ops.flatMap((op) =>
    typeof op === "object" &&
    op !== null &&
    "op" in op &&
    op.op === "setFilter" &&
    "filter" in op
      ? [op.filter]
      : []
  )
}

function LatestAsk({ queries }: { queries: ShowcaseQueries }) {
  const { latest } = useShowcaseActivity()
  if (!latest) {
    return (
      <p className="text-sm text-muted-foreground">
        Pick a suggestion in Preview to see what it sends and what runs.
      </p>
    )
  }
  const ops = opsOf(latest)
  const filters = JSON.stringify(filtersOf(ops))
  const server = queries.asks.find(
    (ask) => JSON.stringify(ask.filters) === filters
  )

  return (
    <div className="flex flex-col gap-4">
      {latest.local === null ? (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">
            Computed in the browser: no new request
          </h4>
          <p className="text-sm text-muted-foreground">
            Pliant applied the operations below in the browser.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">Drawn by the demo: no request</h4>
          <p className="text-sm text-muted-foreground">
            This part isn&apos;t in Pliant yet, so the demo draws the change
            itself. The answer is still the list of operations below.
          </p>
        </div>
      )}
      {server && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            In server mode, Pliant compiles this filter to:
          </p>
          <Query query={server.query} />
        </div>
      )}
      <Json label="Operations the answer contains" value={ops} />
      <p className="text-sm text-muted-foreground">
        The AI only ever returns a list of operations like this one, checked
        against what each part allows. It never writes code or queries.
      </p>
    </div>
  )
}

// What the Acme app loads, and what the visitor's latest ask sent.
export function DataTab({ queries }: { queries: ShowcaseQueries }) {
  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      <section aria-labelledby="latest-ask" className="flex flex-col gap-3">
        <h3 id="latest-ask" className="font-medium">
          Latest ask
        </h3>
        <LatestAsk queries={queries} />
      </section>
      <section aria-labelledby="api-calls" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="api-calls" className="font-medium">
            The demo app&apos;s API
          </h3>
          <p className="text-sm text-muted-foreground">
            What each part of the dashboard loads. In this demo, the responses
            come from data in the page.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {apiCalls.map((call) => (
            <li
              key={call.id}
              className="flex flex-col gap-3 rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {call.method}
                </Badge>
                <code className="font-mono text-sm break-all">{call.path}</code>
                <span className="ml-auto text-xs text-muted-foreground">
                  Used by {call.usedBy}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {call.request !== undefined && (
                  <Json label="Request" value={call.request} />
                )}
                <Json label="Response" value={call.response} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
