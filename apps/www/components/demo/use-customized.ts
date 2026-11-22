"use client"

import * as React from "react"

import type { ResolvedLayers, ResolvedOp } from "@pliantui/core"
import { usePreview, useResolved } from "@pliantui/react"

// Whether the user changed any of `targets`, or their items, in their own
// layers. The preview doesn't count until it's locked in.
export function useCustomized(targets: readonly string[]) {
  const previewId = usePreview()?.id
  const key = targets.join(" ")
  const select = React.useCallback(
    ({ properties, placements }: ResolvedLayers) => {
      const ids = key.split(" ")
      const isOwn = (winner: ResolvedOp | undefined) => {
        if (!winner) return false
        const { layer, id } = winner.overlay
        const { target } = winner.check.op
        return (
          (layer === "personal" || layer === "session") &&
          id !== previewId &&
          ids.some((node) => target === node || target.startsWith(`${node}/`))
        )
      }
      for (const values of properties.values()) {
        for (const { winner } of values.values()) {
          if (isOwn(winner)) return true
        }
      }
      for (const { winner } of placements.values()) {
        if (isOwn(winner)) return true
      }
      return false
    },
    [key, previewId]
  )
  return useResolved(select)
}
