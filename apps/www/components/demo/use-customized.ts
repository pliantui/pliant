"use client"

import * as React from "react"

import type { ResolvedLayers, ResolvedOp } from "@pliantui/core"
import { usePreview, useResolved } from "@pliantui/react"

// A node's identity is its bare id: the part after its last `/slots/`.
function identityOf(address: string) {
  const index = address.lastIndexOf("/slots/")
  return index === -1 ? address : address.slice(index + 7)
}

// Whether an op addresses `node` the way `resetNode` counts it: the node
// itself, one of its items, or a slot addressed through it, at any depth.
function addressesNode(target: string, node: string) {
  const identity = identityOf(target)
  if (identity === node || identity.startsWith(`${node}/`)) return true
  const index = target.lastIndexOf("/slots/")
  return index !== -1 && identityOf(target.slice(0, index)) === node
}

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
          ids.some((node) => addressesNode(target, node))
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
