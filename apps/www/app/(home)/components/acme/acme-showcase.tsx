"use client"

import * as React from "react"

import { usePliantStatus, usePliantStore } from "@pliantui/react"

import {
  actionsOf,
  CustomizeControl,
  CustomizeSurface,
} from "@/components/demo/customize-control"
import { useCustomized } from "@/components/demo/use-customized"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PliantPointMode,
  type PliantPointModeHandle,
} from "@/registry/pliant/pliant-point-mode"

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

// Moves focus to the suggested asks of a part of the dashboard.
function focusAsks(id: string) {
  // After the menu or point mode closes, which may put focus back.
  requestAnimationFrame(() => {
    const asks = document.querySelector(`[data-asks-for="${id}"]`)
    asks?.scrollIntoView({ block: "center", behavior: "smooth" })
    asks?.querySelector("button")?.focus({ preventScroll: true })
  })
}

// The part of the dashboard that has focus, or else the first one.
function focusedPart() {
  const part = document.activeElement?.closest("[data-pliant-id]")
  const id = part?.getAttribute("data-pliant-id")
  return targets.find((target) => target.id === id)?.id ?? targetIds[0] ?? ""
}

const targetIds = targets.map((target) => target.id)

// The dashboard's Customize menu, in its header, and the same items in its
// right-click menu. There's no ask panel here, so Ask moves focus to the
// suggested asks of the part that has focus. Adjust by hand, or holding
// Alt, selects a part, and the selection's Ask moves to its asks.
function ShowcasePreview({ onReset }: { onReset: () => void }) {
  const pointMode = React.useRef<PliantPointModeHandle>(null)
  const store = usePliantStore()
  const { status } = usePliantStatus()
  const { local, clear } = useShowcaseActivity()
  const customized = useCustomized(targetIds)
  const options = {
    customized: customized || local.size > 0,
    ready: status === "ready",
    onAsk: () => {
      focusAsks(focusedPart())
    },
    onAdjust: () => {
      pointMode.current?.start()
    },
    onReset: () => {
      for (const target of targetIds) store.resetNode(target)
      clear()
      onReset()
    },
  }

  return (
    <>
      <CustomizeSurface {...options}>
        <div>
          <AcmeDashboard
            toolbar={
              <CustomizeControl label="the dashboard" commands {...options} />
            }
          />
        </div>
      </CustomizeSurface>
      <PliantPointMode
        ref={pointMode}
        targets={targets}
        actions={(id) => ({
          ...actionsOf({ ...options, onAdjust: undefined }),
          onAsk: () => {
            focusAsks(id)
          },
        })}
      />
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
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-muted-foreground">
              Try a suggestion under any part, or open Customize to ask for a
              change.
            </p>
            <p className="text-xs text-muted-foreground">
              Suggestions play hand-written answers. No model is called.
            </p>
          </div>
        </div>
        <TabsContent
          value="preview"
          forceMount
          // The preview stays mounted while the other tabs show, so it
          // keeps its changes.
          className="overflow-hidden rounded-xl border bg-sidebar data-[state=inactive]:hidden"
        >
          <ShowcasePreview
            key={generation}
            onReset={() => {
              setGeneration((current) => current + 1)
              // The menu's button remounts with the dashboard, so focus
              // goes to the new one.
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLElement>(
                    '[aria-label="Customize the dashboard"]'
                  )
                  ?.focus()
              })
            }}
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
