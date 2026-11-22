"use client"

import { cn } from "cn"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "make the text bigger",
  "compact spacing on this page",
  "turn off animations",
]

const tickets = [
  "Refund not received",
  "Wrong item delivered",
  "GST invoice missing",
]

export function TextSizeDensityMotionMockup() {
  const scripted = useScriptedAsks()
  const big = scripted.has(asks[0] ?? "")
  const compact = scripted.has(asks[1] ?? "")
  const still = scripted.has(asks[2] ?? "")

  return (
    <ScriptedFrame label="display preferences" asks={asks} scripted={scripted}>
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
