import type { LoadedOverlay } from "@pliantui/core"

import { propertiesOf } from "./property-keys"

/** The `id` of a stored overlay, or `undefined` when it has none. */
export function idOf(input: unknown) {
  return typeof input === "object" && input !== null && "id" in input
    ? input.id
    : undefined
}

/** `saved` and then `current`, dropping saved overlays `current` replaces. */
export function mergeById(
  saved: readonly unknown[],
  current: readonly unknown[]
) {
  const ids = new Set(current.map(idOf))
  return [
    ...saved.filter((overlay) => {
      const id = idOf(overlay)
      return id === undefined || !ids.has(id)
    }),
    ...current,
  ]
}

/** The overlay with only the ops, and their explanations, `keep` accepts. */
export function withOps(
  { explain, ...overlay }: LoadedOverlay,
  keep: (index: number) => boolean
) {
  const ops = overlay.ops.filter((_, index) => keep(index))
  return {
    ...overlay,
    ops: ops.map((check) => check.op),
    ...(explain ? { explain: explain.filter((_, index) => keep(index)) } : {}),
  }
}

/**
 * Drops the session ops that write a property in `written`, so a locked
 * version isn't hidden by them; `dropped` lists their properties.
 */
export function withoutProperties(
  load: (input: unknown) => LoadedOverlay | undefined,
  inputs: readonly unknown[],
  written: ReadonlySet<string>
) {
  const dropped: (readonly string[])[] = []
  const kept = inputs.flatMap((input) => {
    const overlay = load(input)
    if (!overlay) {
      return [input]
    }
    const keep = overlay.ops.map((check) => {
      if (check.status !== "valid") {
        return true
      }
      const properties = propertiesOf(check.op)
      if (properties.some((property) => written.has(property))) {
        dropped.push(properties)
        return false
      }
      return true
    })
    if (keep.every(Boolean)) {
      return [input]
    }
    return keep.some(Boolean)
      ? [withOps(overlay, (index) => keep[index] === true)]
      : []
  })
  return { kept, dropped }
}
