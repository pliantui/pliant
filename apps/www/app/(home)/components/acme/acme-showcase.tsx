"use client"

import * as React from "react"

import { usePliantStatus, usePliantStore } from "@pliantui/react"

import { ResetControl } from "@/components/demo/reset-control"
import { useCustomized } from "@/components/demo/use-customized"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PliantPointMode } from "@/registry/pliant/pliant-point-mode"

import { AcmeDashboard } from "./acme-dashboard"
import { ChangesTab } from "./changes-tab"
import { DataTab, type ShowcaseQueries } from "./data-tab"
import {
  ShowcaseActivityProvider,
  useShowcaseActivity,
} from "./showcase-activity"

const targets = [
  { id: "acme-nav", label: "Sidebar" },
  { id: "acme-metrics", label: "Metric cards" },
  { id: "acme-visitors", label: "Total Visitors" },
  { id: "acme-sections", label: "Sections table" },
]

// Moves focus to the suggested asks of the part the user pointed at.
function focusAsks(id: string) {
  // After point mode closes, which puts focus back on its button.
  requestAnimationFrame(() => {
    const asks = document.querySelector(`[data-asks-for="${id}"]`)
    asks?.scrollIntoView({ block: "center", behavior: "smooth" })
    asks?.querySelector("button")?.focus({ preventScroll: true })
  })
}

const targetIds = targets.map((target) => target.id)

function Toolbar({ onReset }: { onReset: () => void }) {
  const store = usePliantStore()
  const { status } = usePliantStatus()
  const { local, clear } = useShowcaseActivity()
  const customized = useCustomized(targetIds)
  return (
    <>
      <ResetControl
        customized={customized || local.size > 0}
        ready={status === "ready"}
        label="the dashboard"
        onReset={() => {
          for (const target of targetIds) store.resetNode(target)
          clear()
          onReset()
        }}
      />
      <PliantPointMode targets={targets} onPick={focusAsks} />
    </>
  )
}

export function AcmeShowcase({ queries }: { queries: ShowcaseQueries }) {
  // Remounting the dashboard on Reset also clears the parts it draws
  // itself.
  const [generation, setGeneration] = React.useState(0)

  return (
    <ShowcaseActivityProvider>
      <Tabs defaultValue="preview" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
          </TabsList>
          <p className="text-sm text-muted-foreground">
            Try a suggestion under any part, or press Point and pick one.
          </p>
        </div>
        <TabsContent
          value="preview"
          forceMount
          // The preview stays mounted while the other tabs show, so it
          // keeps its changes.
          className="overflow-hidden rounded-xl border bg-sidebar data-[state=inactive]:hidden"
        >
          <AcmeDashboard
            key={generation}
            toolbar={
              <Toolbar
                onReset={() => {
                  setGeneration((current) => current + 1)
                }}
              />
            }
          />
        </TabsContent>
        <TabsContent value="data" className="rounded-xl border">
          <DataTab queries={queries} />
        </TabsContent>
        <TabsContent value="changes" className="rounded-xl border">
          <ChangesTab />
        </TabsContent>
      </Tabs>
    </ShowcaseActivityProvider>
  )
}
