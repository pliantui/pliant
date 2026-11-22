"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks.messages

const cards = [
  { id: "revenue", label: "Revenue", value: "₹37,76,600" },
  { id: "aov", label: "Average order value", value: "₹85,832" },
  { id: "overdue", label: "Overdue", value: "56" },
]

export function MessagesMockup() {
  const scripted = useScriptedAsks()
  const original = scripted.has(asks.original)
  const label = (id: string, fallback: string) => {
    if (original) return fallback
    if (id === "overdue" && scripted.has(asks.renameOverdue)) return "Dues"
    if (id === "aov" && scripted.has(asks.renameAov)) return "AOV"
    return fallback
  }

  return (
    <ScriptedFrame
      label="card labels"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.id} className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">
              {label(card.id, card.label)}
            </p>
            <p className="text-lg font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>
    </ScriptedFrame>
  )
}
