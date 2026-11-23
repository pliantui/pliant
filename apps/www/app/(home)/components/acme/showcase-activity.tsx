"use client"

import * as React from "react"

import { usePreview } from "@pliantui/react"

// The overlay of the visitor's latest customization of the showcase, for
// its Data and Changes tabs, and whether it's kept or still a preview.
export interface ShowcaseChange {
  overlay: { id: string } & Record<string, unknown>
  state: "previewing" | "kept"
}

interface ShowcaseActivity {
  latest: ShowcaseChange | null
  // For an ask a part of the showcase plays itself, rather than through the
  // layers, like the chart's.
  record: (change: ShowcaseChange | null) => void
  // Called when the user discards the previewed change.
  discard: () => void
  // The parts showing a change they draw themselves.
  local: ReadonlySet<string>
  setLocal: (target: string, changed: boolean) => void
  // Forgets every change, after Reset.
  clear: () => void
}

const ShowcaseActivityContext = React.createContext<ShowcaseActivity | null>(
  null
)

export function ShowcaseActivityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const preview = usePreview()
  const [latest, setLatest] = React.useState<ShowcaseChange | null>(null)
  const [seen, setSeen] = React.useState<string | null>(null)
  const [local, setLocalTargets] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )

  // A preview from the layers becomes the latest change, and is kept when
  // the preview ends, unless the user discarded it.
  const previewId = preview?.id ?? null
  if (previewId !== seen) {
    setSeen(previewId)
    if (preview) {
      // The overlay as Pliant stores it, without the checks it was
      // loaded with.
      setLatest({
        overlay: { ...preview, ops: preview.ops.map((check) => check.op) },
        state: "previewing",
      })
    } else if (latest?.state === "previewing" && latest.overlay.id === seen) {
      setLatest({ ...latest, state: "kept" })
    }
  }

  const value = React.useMemo<ShowcaseActivity>(
    () => ({
      latest,
      record: setLatest,
      discard: () => {
        setLatest(null)
      },
      local,
      setLocal: (target, changed) => {
        setLocalTargets((current) => {
          const next = new Set(current)
          if (changed) next.add(target)
          else next.delete(target)
          return next
        })
      },
      clear: () => {
        setLatest(null)
        setLocalTargets(new Set())
      },
    }),
    [latest, local]
  )

  return (
    <ShowcaseActivityContext value={value}>{children}</ShowcaseActivityContext>
  )
}

export function useShowcaseActivity() {
  const activity = React.use(ShowcaseActivityContext)
  if (!activity) {
    throw new Error(
      "useShowcaseActivity must be used inside ShowcaseActivityProvider"
    )
  }
  return activity
}
