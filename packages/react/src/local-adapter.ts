import type { StoredOverlay } from "@pliantui/contract"

import type { StorageAdapter } from "./storage-adapter"
import { StorageConflictError } from "./storage-conflict-error"
import { ulid } from "./ulid"

const version = 1
const prefix = "pliant:"

interface LocalDocument {
  /** Every saved entry, including those this version doesn't understand. */
  readonly entries: readonly unknown[]
  readonly newer: boolean
}

function readDocument(key: string): LocalDocument {
  let value: unknown
  try {
    value = JSON.parse(localStorage.getItem(key) ?? "null")
  } catch {
    return { entries: [], newer: false }
  }
  if (typeof value !== "object" || value === null || !("v" in value)) {
    return { entries: [], newer: false }
  }
  if (typeof value.v === "number" && value.v > version) {
    return { entries: [], newer: true }
  }
  const personal = "personal" in value ? value.personal : undefined
  return {
    entries: value.v === version && Array.isArray(personal) ? personal : [],
    newer: false,
  }
}

// Only the overlay is checked here: core's `loadOverlay` checks the rest
// when the store applies it.
function isRecord(entry: unknown): entry is StoredOverlay {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "etag" in entry &&
    typeof entry.etag === "string" &&
    "version" in entry &&
    Number.isInteger(entry.version) &&
    "updatedAt" in entry &&
    typeof entry.updatedAt === "string" &&
    "overlay" in entry &&
    typeof entry.overlay === "object" &&
    entry.overlay !== null
  )
}

function recordsOf(key: string) {
  return readDocument(key).entries.filter(isRecord)
}

// Reads the document again right before each write, so a write doesn't
// drop what another tab stored since this one loaded.
function openRecord(surface: string, id: string) {
  const key = prefix + surface
  const { entries, newer } = readDocument(key)
  if (newer) {
    throw new Error(
      `The overlays saved for ${surface} were written by a newer version of Pliant`
    )
  }
  const current = entries
    .filter(isRecord)
    .find((record) => record.overlay.id === id)
  const others = entries.filter((entry) => entry !== current)
  return {
    current,
    check(ifMatch: string | null) {
      if ((current?.etag ?? null) !== ifMatch) {
        throw new StorageConflictError(current)
      }
    },
    write(...records: StoredOverlay[]) {
      localStorage.setItem(
        key,
        JSON.stringify({ v: version, personal: [...others, ...records] })
      )
    },
  }
}

/**
 * Stores personal overlays in `localStorage`, one key per surface, as
 * versioned JSON. Data that doesn't parse loads as no overlays. Data written
 * by a newer version loads as no overlays and is never overwritten: saving
 * over it throws.
 *
 * Other tabs of the same origin share the stored overlays, and `subscribe`
 * tells each tab when another one changes them, through the `storage`
 * event.
 *
 * @experimental
 */
export function localAdapter(): StorageAdapter {
  return {
    load(surface) {
      return { personal: recordsOf(prefix + surface) }
    },
    save(surface, overlay, { ifMatch }) {
      if (overlay.layer !== "personal") {
        throw new TypeError("localAdapter stores personal overlays only")
      }
      const stored = openRecord(surface, overlay.id)
      stored.check(ifMatch)
      const now = Date.now()
      const record = {
        overlay,
        etag: ulid(now),
        version: (stored.current?.version ?? 0) + 1,
        updatedAt: new Date(now).toISOString(),
      }
      stored.write(record)
      return record
    },
    remove(surface, id, { ifMatch }) {
      const stored = openRecord(surface, id)
      if (stored.current) {
        stored.check(ifMatch)
        stored.write()
      }
    },
    list(layer) {
      if (layer !== "personal") {
        return []
      }
      return Array.from({ length: localStorage.length }, (_, index) =>
        localStorage.key(index)
      ).flatMap((key) => (key?.startsWith(prefix) ? recordsOf(key) : []))
    },
    subscribe(surface, onChange) {
      function onStorage(event: StorageEvent) {
        if (
          event.storageArea === localStorage &&
          (event.key === null || event.key === prefix + surface)
        ) {
          onChange()
        }
      }
      window.addEventListener("storage", onStorage)
      return () => {
        window.removeEventListener("storage", onStorage)
      }
    },
  }
}
