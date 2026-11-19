import { resolveLayers, type LoadedOverlay } from "@pliantui/core"

/**
 * The (identity, property, breakpoints) pairs an overlay writes, as one
 * string, or `undefined` when an op doesn't apply on its own. Two overlays
 * with the same keys write exactly the same values, so the later one can
 * replace the earlier one. Core resolves the overlay alone to find them, so
 * this follows its op → property table.
 */
export function propertyKeysOf(overlay: LoadedOverlay, surface: string) {
  const { properties, placements, skipped, unapplied } = resolveLayers(
    [overlay],
    { surface }
  )
  if (skipped.length > 0 || unapplied.length > 0) {
    return undefined
  }
  const keys: string[] = []
  for (const [identity, byProperty] of properties) {
    for (const [property, { breakpoints }] of byProperty) {
      keys.push(
        JSON.stringify([identity, property, [...(breakpoints?.keys() ?? [])]])
      )
    }
  }
  for (const identity of placements.keys()) {
    keys.push(JSON.stringify([identity, "placement"]))
  }
  return keys.sort().join("\n")
}
