// #region layers
"use client"

import type { ReactNode } from "react"

import { PliantRoot, type StoredLayers } from "@pliantui/react"
import { serverAdapter } from "@pliantui/react/server-adapter"

const storage = serverAdapter({ endpoint: "/api/pliant/storage" })

export function OrdersRoot({
  layers,
  children,
}: {
  layers: StoredLayers
  children: ReactNode
}) {
  return (
    <PliantRoot surface="/orders" storage={storage} layers={layers}>
      {children}
    </PliantRoot>
  )
}
// #endregion layers
