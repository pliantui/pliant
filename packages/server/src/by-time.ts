import type { StoredOverlay } from "@pliantui/contract"

/** Orders records oldest first: by `updatedAt`, `version`, then overlay id. */
export function byTime(a: StoredOverlay, b: StoredOverlay) {
  return (
    Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
    a.version - b.version ||
    (a.overlay.id < b.overlay.id ? -1 : a.overlay.id > b.overlay.id ? 1 : 0)
  )
}
