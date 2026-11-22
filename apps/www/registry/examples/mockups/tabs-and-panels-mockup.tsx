"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["tabs-and-panels"]

const panels = {
  overview: {
    label: "Overview",
    body: "ORD-1042 · Kaveri Agro · ₹96,550 · Overdue by 12 days",
  },
  invoices: {
    label: "Invoices",
    body: "GST invoice INV-2026-0418, sent 2 Oct 2026",
  },
  notes: {
    label: "Notes",
    body: "Customer asked to split delivery across two dates.",
  },
  activity: {
    label: "Activity",
    body: "Priya Kapoor marked the order overdue on 14 Oct.",
  },
}

type Panel = keyof typeof panels

export function TabsAndPanelsMockup() {
  const scripted = useScriptedAsks()
  let order: Panel[] = ["overview", "invoices", "notes", "activity"]
  if (scripted.has(asks.notesFirst)) {
    order = ["notes", ...order.filter((id) => id !== "notes")]
  }
  if (scripted.has(asks.hideActivity)) {
    order = order.filter((id) => id !== "activity")
  }
  const opening = scripted.has(asks.openInvoices) ? "invoices" : "overview"

  return (
    <ScriptedFrame
      label="order tabs"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <Tabs key={`${opening}-${order.join()}`} defaultValue={opening}>
        <TabsList>
          {order.map((id) => (
            <TabsTrigger key={id} value={id}>
              {panels[id].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {order.map((id) => (
          <TabsContent
            key={id}
            value={id}
            className="rounded-xl border p-4 text-sm"
          >
            {panels[id].body}
          </TabsContent>
        ))}
      </Tabs>
    </ScriptedFrame>
  )
}
