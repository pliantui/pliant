"use client"

import * as React from "react"

import type { ResolvedLayers, ResolvedOp } from "@pliantui/core"
import { usePreview, useResolved } from "@pliantui/react"

// A node's identity is its bare id: the part after its last `/slots/`.
function identityOf(address: string) {
  const index = address.lastIndexOf("/slots/")
  return index === -1 ? address : address.slice(index + 7)
}

// A node's placement, span, visibility and insertion belong to its container,
// and a slot's removal stays, so Reset leaves those and they don't count.
const containerProperties = new Set([
  "placement",
  "visible",
  "inserted",
  "span",
])
const slotProperties = new Set(["placement", "visible", "span"])

// Whether Reset on `node` drops a change to this property: one of the node's
// own, one of its items', or a slot's, made through the node at any depth.
function resetDrops(
  address: string,
  property: string,
  target: string,
  node: string
) {
  if (address.startsWith(`${node}/`)) return true
  if (address === node) return !containerProperties.has(property)
  return (
    slotProperties.has(property) &&
    !address.includes("/") &&
    target.endsWith(`/slots/${address}`) &&
    identityOf(target.slice(0, -7 - address.length)) === node
  )
}

// Whether the user changed any of `targets`, or their items, in their own
// layers. The preview doesn't count until it's locked in.
export function useCustomized(targets: readonly string[]) {
  const previewId = usePreview()?.id
  const key = targets.join(" ")
  const select = React.useCallback(
    ({ properties, placements }: ResolvedLayers) => {
      const ids = key.split(" ")
      const isOwn = (
        winner: ResolvedOp | undefined,
        address: string,
        property: string
      ) => {
        if (!winner) return false
        const { layer, id } = winner.overlay
        const { target } = winner.check.op
        return (
          (layer === "personal" || layer === "session") &&
          id !== previewId &&
          ids.some((node) => resetDrops(address, property, target, node))
        )
      }
      for (const [address, values] of properties) {
        for (const [property, { winner }] of values) {
          if (isOwn(winner, address, property)) return true
        }
      }
      for (const [address, { winner }] of placements) {
        if (isOwn(winner, address, "placement")) return true
      }
      return false
    },
    [key, previewId]
  )
  return useResolved(select)
}
