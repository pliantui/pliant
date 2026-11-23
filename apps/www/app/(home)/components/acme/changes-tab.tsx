"use client"

import { useShowcaseActivity } from "./showcase-activity"

// The overlay of the visitor's latest change, as Pliant stores it.
export function ChangesTab() {
  const { latest } = useShowcaseActivity()

  if (!latest) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="font-medium">No changes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Pick a suggestion in Preview. The change it makes shows here as the
          overlay Pliant saves.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">
        {latest.state === "kept"
          ? "The overlay of your latest change."
          : "The overlay being previewed. Lock it in to keep it."}
      </p>
      <pre
        role="region"
        tabIndex={0}
        aria-label="Overlay"
        className="max-h-[560px] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {JSON.stringify(latest.overlay, null, 2)}
      </pre>
    </div>
  )
}
