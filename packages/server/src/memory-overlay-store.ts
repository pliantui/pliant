import type { StoredOverlay } from "@pliantui/contract"

import type { OverlayKey, OverlayQuery, OverlayStore } from "./overlay-store"

interface Entry {
  readonly key: OverlayKey
  readonly record: StoredOverlay
}

function keyOf({ surface, layer, scope, id }: OverlayKey) {
  return JSON.stringify([surface, layer, scope, id])
}

function matches({ key }: Entry, { scopes, surfaces, id }: OverlayQuery) {
  return (
    (id === undefined || key.id === id) &&
    (surfaces === undefined || surfaces.includes(key.surface)) &&
    scopes.some(
      (scope) => scope.layer === key.layer && scope.scope === key.scope
    )
  )
}

function byTime(a: StoredOverlay, b: StoredOverlay) {
  return (
    Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
    a.version - b.version ||
    (a.overlay.id < b.overlay.id ? -1 : a.overlay.id > b.overlay.id ? 1 : 0)
  )
}

/**
 * Keeps stored overlays in memory, every version of each one, for tests,
 * demos and examples. They are lost when the process exits, and each
 * server instance has its own, so use a database in production.
 *
 * @experimental
 */
export function memoryOverlayStore(): OverlayStore {
  const current = new Map<string, Entry>()
  const versions: Entry[] = []

  return {
    get(key) {
      return Promise.resolve(current.get(keyOf(key))?.record)
    },
    put(key, record, ifMatch) {
      const id = keyOf(key)
      if ((current.get(id)?.record.etag ?? null) !== ifMatch) {
        return Promise.resolve(false)
      }
      const entry = { key, record }
      current.set(id, entry)
      versions.push(entry)
      return Promise.resolve(true)
    },
    list(query) {
      return Promise.resolve(
        [...current.values()]
          .filter((entry) => matches(entry, query))
          .map((entry) => entry.record)
      )
    },
    history(query) {
      return Promise.resolve(
        versions
          .filter((entry) => matches(entry, query))
          .map((entry) => entry.record)
          .sort(byTime)
      )
    },
  }
}
