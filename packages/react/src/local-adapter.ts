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

/**
 * Stores personal overlays in `localStorage`, one key per overlay:
 * `pliant:<surface>:<id>`, holding its stored record as JSON. An entry that
 * isn't a valid record doesn't load and is never overwritten.
 *
 * `subscribe` tells each `PliantRoot` when another one, in this tab or
 * another tab of the same origin, changes a surface's overlays.
 *
 * @experimental
 */
export function localAdapter(): StorageAdapter {
  return {
    load(surface) {
      const prefix = prefixOf(surface)
      const personal: StoredOverlay[] = []
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index)
        const record =
          key?.startsWith(prefix) && !key.includes(":", prefix.length)
            ? readRecord(key)
            : undefined
        if (record) {
          personal.push(record)
        }
      }
      return { personal }
    },
    save(surface, overlay, { ifMatch }) {
      if (overlay.layer !== "personal") {
        throw new TypeError("localAdapter stores personal overlays only")
      }
      const key = prefixOf(surface) + overlay.id
      const now = Date.now()
      const record = {
        overlay,
        etag: ulid(now),
        version: (claim(key, ifMatch)?.version ?? 0) + 1,
        updatedAt: new Date(now).toISOString(),
      }
      localStorage.setItem(key, JSON.stringify(record))
      return record
    },
    remove(surface, id, { ifMatch }) {
      const key = prefixOf(surface) + id
      if (localStorage.getItem(key) !== null) {
        claim(key, ifMatch)
        localStorage.removeItem(key)
      }
    },
    subscribe(surface, onChange) {
      const prefix = prefixOf(surface)
      const listener = (key: string | null) => {
        if (key === null || key.startsWith(prefix)) {
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
