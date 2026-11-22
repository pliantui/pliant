import type { StoredLayers } from "@pliantui/react"

// Stands in for the app's own read from its overlay store.
export function loadLayers(surface: string): Promise<StoredLayers> {
  return Promise.resolve(surface === "" ? {} : { personal: [] })
}
