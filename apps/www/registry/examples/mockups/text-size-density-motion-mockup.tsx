"use client"

import { cn } from "cn"

import { ScriptedFrame } from "@/components/demo/scripted-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { mockupAsks } from "@/lib/components/mockup-asks"

const asks = mockupAsks["text-size-density-motion"]

const tickets = [
  "Refund not received",
  "Wrong item delivered",
  "GST invoice missing",
]

export function TextSizeDensityMotionMockup() {
  const scripted = useScriptedAsks()
  const big = scripted.has(asks.bigger)
  const compact = scripted.has(asks.compact)
  const still = scripted.has(asks.still)

  return (
    <ScriptedFrame
      label="display preferences"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <ul
        aria-label="Open tickets"
        className={cn(
          "divide-y rounded-xl border",
          big ? "text-base" : "text-sm"
        )}
      >
        {tickets.map((ticket, index) => (
          <li
            key={ticket}
            className={cn(
              "flex items-center gap-3 px-3",
              compact ? "py-1.5" : "py-3"
            )}
          >
            {index === 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full bg-foreground",
                  !still && "motion-safe:animate-pulse"
                )}
              />
            )}
            {ticket}
          </li>
        ))}
      </ul>
    </ScriptedFrame>
  )
}
