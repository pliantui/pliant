import {
  storedOverlaySchema,
  type Overlay,
  type StoredOverlay,
} from "@pliantui/contract"

import type { StorageAdapter } from "../src/storage-adapter"
import { StorageConflictError } from "../src/storage-conflict-error"

let etags = 0

/** Wraps an overlay in a stored record with a new etag. */
export function recordOf(overlay: unknown, version = 1): StoredOverlay {
  return storedOverlaySchema.parse({
    overlay,
    etag: `etag-${String(++etags)}`,
    version,
    updatedAt: "2026-11-19T00:00:00.000Z",
  })
}

/** Wraps overlays in stored records, as an adapter returns them. */
export function stored(...overlays: unknown[]): StoredOverlay[] {
  return overlays.map((overlay) => recordOf(overlay))
}

export interface StoredInput {
  readonly org?: readonly unknown[]
  readonly team?: readonly unknown[]
  readonly personal?: readonly unknown[]
}

/**
 * An adapter that keeps records in memory and checks `ifMatch` as a real
 * one does. `saved` lists every overlay it saved, in order.
 */
export function memoryStorage({
  org = [],
  team = [],
  personal = [],
}: StoredInput = {}) {
  const records = new Map(
    stored(...personal).map((record) => [record.overlay.id, record])
  )
  const orgRecords = stored(...org)
  const teamRecords = stored(...team)
  const saved: Overlay[] = []
  const storage: StorageAdapter = {
    load: () => ({
      org: orgRecords,
      team: teamRecords,
      personal: [...records.values()],
    }),
    save(_surface, overlay, { ifMatch }) {
      const current = records.get(overlay.id)
      if ((current?.etag ?? null) !== ifMatch) {
        throw new StorageConflictError(current)
      }
      const record = recordOf(overlay, (current?.version ?? 0) + 1)
      saved.push(overlay)
      records.set(overlay.id, record)
      return record
    },
    remove(_surface, id, { ifMatch }) {
      const current = records.get(id)
      if (current && current.etag !== ifMatch) {
        throw new StorageConflictError(current)
      }
      records.delete(id)
    },
  }
  return { storage, saved, records }
}
