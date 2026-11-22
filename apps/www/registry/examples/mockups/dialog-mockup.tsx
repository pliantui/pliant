"use client"

import { cn } from "cn"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "open this as a side sheet",
  "make it bigger",
  "show it as a drawer from the bottom",
  "fold delivery notes away",
]

export function DialogMockup() {
  const scripted = useScriptedAsks()
  const drawer = scripted.has(asks[2] ?? "")
  const sheet = !drawer && scripted.has(asks[0] ?? "")
  const big = scripted.has(asks[1] ?? "")
  const folded = scripted.has(asks[3] ?? "")

  return (
    <ScriptedFrame label="edit order dialog" asks={asks} scripted={scripted}>
      <div
        className={cn(
          "relative flex h-80 overflow-hidden rounded-xl bg-muted/60 dark:bg-muted/30",
          drawer
            ? "items-end"
            : sheet
              ? "justify-end"
              : "items-center justify-center"
        )}
      >
        <div
          role="group"
          aria-label={`Edit ORD-1042, shown as a ${drawer ? "drawer" : sheet ? "side sheet" : "dialog"}`}
          className={cn(
            "flex flex-col gap-3 border bg-background p-4 text-sm shadow-lg",
            drawer
              ? "h-3/5 w-full rounded-t-xl"
              : sheet
                ? cn("h-full", big ? "w-4/5" : "w-3/5")
                : cn("rounded-xl", big ? "w-11/12" : "w-3/4")
          )}
        >
          <p className="font-semibold">Edit ORD-1042</p>
          <p className="text-muted-foreground">Kaveri Agro · ₹96,550</p>
          <div className="rounded-md border px-3 py-2">
            Delivery date: 28 Oct 2026
          </div>
          {folded ? (
            <p className="text-muted-foreground">More fields: Delivery notes</p>
          ) : (
            <div className="rounded-md border px-3 py-2">
              Delivery notes: Leave with the warehouse at Gate 2.
            </div>
          )}
        </div>
      </div>
    </ScriptedFrame>
  )
}
