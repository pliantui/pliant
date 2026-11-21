import type { StoredOverlay } from "@pliantui/contract"

import { byTime } from "./by-time"
import type { OverlayKey, OverlayQuery, OverlayStore } from "./overlay-store"

interface Entry {
  readonly key: OverlayKey
  readonly record: StoredOverlay
  readonly by: string
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

/**
 * Keeps stored overlays in memory, every version of each one and who
 * stored it, for tests, demos and examples. They are lost when the process
 * exits, and each server instance has its own, so use a database in
 * production.
 *
 * @experimental
 */
export function memoryOverlayStore(): OverlayStore {
  const current = new Map<string, Entry>()
  const versions: Entry[] = []

  return {
    get(key) {
      const entry = current.get(keyOf(key))
      return Promise.resolve(entry && structuredClone(entry.record))
    },
    put(key, record, ifMatch, { by }) {
      const id = keyOf(key)
      if ((current.get(id)?.record.etag ?? null) !== ifMatch) {
        return Promise.resolve(false)
      }
      const entry = { key, record: structuredClone(record), by }
      current.set(id, entry)
      versions.push(entry)
      return Promise.resolve(true)
    },
    list(query) {
      return Promise.resolve(
        [...current.values()]
          .filter((entry) => matches(entry, query))
          .map((entry) => structuredClone(entry.record))
      )
    },
    history(query) {
      return Promise.resolve(
        versions
          .filter((entry) => matches(entry, query))
          .map(({ record, by }) => ({ record: structuredClone(record), by }))
          .sort((a, b) => byTime(a.record, b.record))
      )
    },
  }
}
