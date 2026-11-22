"use client"

import * as React from "react"

// The asks a mockup preview plays, as hand-written changes to its own state.
export function useScriptedAsks() {
  const [applied, setApplied] = React.useState<readonly string[]>([])
  return {
    applied,
    has: (prompt: string) => applied.includes(prompt),
    // A second press takes the ask back.
    ask: (prompt: string) => {
      setApplied((current) =>
        current.includes(prompt)
          ? current.filter((entry) => entry !== prompt)
          : [...current, prompt]
      )
    },
    reset: () => {
      setApplied([])
    },
  }
}

export type ScriptedAsksState = ReturnType<typeof useScriptedAsks>
