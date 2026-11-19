import type { StorageAdapter } from "./storage-adapter"

const version = 1

interface LocalDocument {
  readonly personal: readonly unknown[]
  readonly newer: boolean
}

function keyOf(surface: string) {
  return `pliant:${surface}`
}

function readDocument(key: string): LocalDocument {
  let value: unknown
  try {
    value = JSON.parse(localStorage.getItem(key) ?? "null")
  } catch {
    return { personal: [], newer: false }
  }
  if (typeof value !== "object" || value === null || !("v" in value)) {
    return { personal: [], newer: false }
  }
  if (typeof value.v === "number" && value.v > version) {
    return { personal: [], newer: true }
  }
  const personal = "personal" in value ? value.personal : undefined
  return {
    personal: value.v === version && Array.isArray(personal) ? personal : [],
    newer: false,
  }
}

/**
 * Stores personal overlays in `localStorage`, one key per surface, as
 * versioned JSON. Data that doesn't parse loads as no overlays. Data written
 * by a newer version loads as no overlays and is never overwritten: saving
 * over it throws.
 *
 * @experimental
 */
export function localAdapter(): StorageAdapter {
  return {
    load(surface) {
      return { personal: readDocument(keyOf(surface)).personal }
    },
    save(surface, overlay) {
      const key = keyOf(surface)
      const { personal, newer } = readDocument(key)
      if (newer) {
        throw new Error(
          `The overlays saved for ${surface} were written by a newer version of Pliant`
        )
      }
      const others = personal.filter(
        (saved) =>
          typeof saved !== "object" ||
          saved === null ||
          !("id" in saved) ||
          saved.id !== overlay.id
      )
      localStorage.setItem(
        key,
        JSON.stringify({ v: version, personal: [...others, overlay] })
      )
    },
  }
}
