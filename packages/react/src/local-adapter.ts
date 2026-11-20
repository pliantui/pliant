import { storedOverlaySchema, type StoredOverlay } from "@pliantui/contract"

import type { StorageAdapter } from "./storage-adapter"
import { StorageConflictError } from "./storage-conflict-error"
import { ulid } from "./ulid"

// The `storage` event reaches only other documents, so roots in this one
// are told directly.
const listeners = new Set<(key: string) => void>()

function prefixOf(surface: string) {
  return `pliant:${surface}:`
}

function readRecord(key: string): StoredOverlay | undefined {
  try {
    const result = storedOverlaySchema.safeParse(
      JSON.parse(localStorage.getItem(key) ?? "null")
    )
    return result.success ? result.data : undefined
  } catch {
    return undefined
  }
}

function claim(key: string, ifMatch: string | null) {
  const current = readRecord(key)
  // An entry that isn't a readable record, such as one written by a newer
  // version, is never overwritten.
  if (
    current?.deletedAt ||
    (current?.etag ?? null) !== ifMatch ||
    (!current && localStorage.getItem(key) !== null)
  ) {
    throw new StorageConflictError(current)
  }
  queueMicrotask(() => {
    for (const listener of listeners) {
      listener(key)
    }
  })
  return current
}

function write(
  key: string,
  overlay: StoredOverlay["overlay"],
  previous: StoredOverlay | undefined,
  { removed = false }: { removed?: boolean } = {}
): StoredOverlay {
  const now = Date.now()
  const updatedAt = new Date(now).toISOString()
  const record = {
    overlay,
    etag: ulid(now),
    version: (previous?.version ?? 0) + 1,
    updatedAt,
    ...(removed && { deletedAt: updatedAt }),
  }
  localStorage.setItem(key, JSON.stringify(record))
  return record
}

function owns(key: string, surfaces: readonly string[]) {
  return surfaces.some((surface) => {
    const prefix = prefixOf(surface)
    return key.startsWith(prefix) && !key.includes(":", prefix.length)
  })
}

// Every readable record of the surfaces, tombstones included.
function recordsOf(...surfaces: string[]) {
  const records: StoredOverlay[] = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    const record = key && owns(key, surfaces) ? readRecord(key) : undefined
    if (record) {
      records.push(record)
    }
  }
  return records
}

/**
 * Stores personal overlays in `localStorage`, one key per overlay:
 * `pliant:<surface>:<id>`, holding its stored record as JSON. An entry that
 * isn't a valid record doesn't load and is never overwritten.
 *
 * `remove` leaves a tombstone under the overlay's key and keeps it, so a
 * removed overlay is never stored again under its id. The tombstone holds
 * the removed overlay; to erase it at once, remove the key from
 * `localStorage`, and a late retry of a save from before the removal can
 * then store the overlay again. `history` returns the record under each
 * key, tombstones included: the latest record of every overlay, not
 * earlier versions. Records are ordered by `updatedAt`; records with the
 * same millisecond are ordered by `version`, then by overlay id.
 *
 * `load` also returns the overlays stored for `@app`, which apply on every
 * surface. `subscribe` tells each `PliantRoot` when another one, in this tab
 * or another tab of the same origin, changes a surface's overlays or the
 * `@app` overlays.
 *
 * @experimental
 */
export function localAdapter(): StorageAdapter {
  return {
    load(surface) {
      return {
        personal: recordsOf(surface, "@app").filter(
          (record) => !record.deletedAt
        ),
      }
    },
    save(surface, overlay, { ifMatch }) {
      if (overlay.layer !== "personal") {
        throw new TypeError("localAdapter stores personal overlays only")
      }
      const key = prefixOf(surface) + overlay.id
      return write(key, overlay, claim(key, ifMatch))
    },
    remove(surface, id, { ifMatch }) {
      const key = prefixOf(surface) + id
      if (localStorage.getItem(key) !== null && !readRecord(key)?.deletedAt) {
        const current = claim(key, ifMatch)
        if (current) {
          write(key, current.overlay, current, { removed: true })
        }
      }
    },
    history(surface, id) {
      return recordsOf(surface)
        .filter((record) => id === undefined || record.overlay.id === id)
        .sort(
          (a, b) =>
            Date.parse(a.updatedAt) - Date.parse(b.updatedAt) ||
            a.version - b.version ||
            (a.overlay.id < b.overlay.id
              ? -1
              : a.overlay.id > b.overlay.id
                ? 1
                : 0)
        )
    },
    subscribe(surface, onChange) {
      const listener = (key: string | null) => {
        if (key === null || owns(key, [surface, "@app"])) {
          onChange()
        }
      }
      function onStorage(event: StorageEvent) {
        if (event.storageArea === localStorage) {
          listener(event.key)
        }
      }
      listeners.add(listener)
      window.addEventListener("storage", onStorage)
      return () => {
        listeners.delete(listener)
        window.removeEventListener("storage", onStorage)
      }
    },
  }
}
