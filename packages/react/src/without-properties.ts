import type { LoadedOverlay } from "@pliantui/core"

import { withOps } from "./overlay-list"
import { propertiesOf } from "./property-keys"

// The session ops that write a property in `written` are dropped, so a
// locked version isn't hidden by them; `dropped` lists their properties.
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
