"use client"

import * as React from "react"

import { usePreview } from "@pliantui/react"

// A change the visitor made to the showcase, for its Data and Changes tabs:
// its overlay, whether it's kept or still a preview, and, for a part that
// isn't in Pliant yet, the part the showcase draws the change in.
export interface ShowcaseChange {
  overlay: { id: string } & Record<string, unknown>
  state: "previewing" | "kept"
  local: string | null
}

interface ShowcaseActivity {
  // The change being previewed, else the latest kept one.
  latest: ShowcaseChange | null
  // Previews a change a part draws itself.
  previewLocal: (target: string, overlay: ShowcaseChange["overlay"]) => void
  // Keeps the change being previewed.
  keep: () => void
  // Drops the change being previewed.
  discard: () => void
  // Takes back the kept changes a part drew itself.
  removeLocal: (target: string) => void
  // The parts showing a change they draw themselves.
  local: ReadonlySet<string>
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
  const [kept, setKept] = React.useState<readonly ShowcaseChange[]>([])
  const [previewing, setPreviewing] = React.useState<ShowcaseChange | null>(
    null
  )
  const [seen, setSeen] = React.useState<string | null>(null)

  // A preview from the layers is the change being previewed, and is kept
  // when the preview ends, unless the user discarded it.
  const previewId = preview?.id ?? null
  if (previewId !== seen) {
    setSeen(previewId)
    if (preview) {
      // The overlay as Pliant stores it, without the checks it was
      // loaded with.
      setPreviewing({
        overlay: { ...preview, ops: preview.ops.map((check) => check.op) },
        state: "previewing",
        local: null,
      })
    } else if (previewing?.local === null && previewing.overlay.id === seen) {
      setKept([...kept, { ...previewing, state: "kept" }])
      setPreviewing(null)
    }
  }

  const value = React.useMemo<ShowcaseActivity>(() => {
    const local = new Set(
      [...kept, ...(previewing ? [previewing] : [])].flatMap((change) =>
        change.local === null ? [] : [change.local]
      )
    )
    return {
      latest: previewing ?? kept.at(-1) ?? null,
      previewLocal: (target, overlay) => {
        setPreviewing({ overlay, state: "previewing", local: target })
      },
      keep: () => {
        if (!previewing) return
        setKept((current) => [...current, { ...previewing, state: "kept" }])
        setPreviewing(null)
      },
      discard: () => {
        setPreviewing(null)
      },
      removeLocal: (target) => {
        setKept((current) =>
          current.filter((change) => change.local !== target)
        )
      },
      local,
      clear: () => {
        setKept([])
        setPreviewing(null)
      },
    }
  }, [kept, previewing])

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
