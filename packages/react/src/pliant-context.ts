import { createContext, use } from "react"

import type { LayerStore } from "./layer-store"

export const PliantContext = createContext<LayerStore | null>(null)

export function useLayerStore(hook: string) {
  const store = use(PliantContext)
  if (store === null) {
    throw new Error(`${hook} must be used within a PliantRoot`)
  }
  return store
}
