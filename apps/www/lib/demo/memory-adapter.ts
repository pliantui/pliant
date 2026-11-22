import type {
  StorageAdapter,
  StoredLayers,
  StoredOverlay,
} from "@pliantui/react"

// Storage that loads the given layers and keeps changes only until the page
// unloads, for demos that start fresh on every visit.
export function memoryAdapter(layers: StoredLayers = {}): () => StorageAdapter {
  return () => ({
    load: () => layers,
    save: (_surface, overlay): StoredOverlay => ({
      overlay,
      etag: crypto.randomUUID(),
      version: 1,
      updatedAt: new Date().toISOString(),
    }),
    remove: () => undefined,
  })
}
