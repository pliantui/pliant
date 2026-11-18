import { compareData } from "./compare-data"
import type { LoadedOverlay } from "./load-overlay"
import { contentOf, orderOverlays } from "./order-overlays"

export interface OrderedOverlay {
  readonly overlay: LoadedOverlay
  /** Why every op of the overlay is skipped, if it is. */
  readonly reason: "duplicate-id" | "surface-mismatch" | undefined
}

/**
 * The overlays in resolution order, each with why it is skipped: it is for
 * another surface than `surface` (other than `@app`), or its id is taken by
 * an earlier overlay or by a tied overlay with other contents.
 */
export function surfaceOrder(
  overlays: readonly LoadedOverlay[],
  surface: unknown,
  teamOrder: readonly string[]
): OrderedOverlay[] {
  if (typeof surface !== "string") {
    throw new TypeError("Resolving layers needs the surface as a string")
  }
  const ordered: OrderedOverlay[] = []
  const seen = new Set<string>()
  for (const group of orderOverlays(overlays, teamOrder)) {
    const matching = group.filter(
      (overlay) => overlay.surface === surface || overlay.surface === "@app"
    )
    const [first, ...rest] = matching
    const content = first && contentOf(first)
    const ambiguous = rest.some(
      (overlay) => compareData(content, contentOf(overlay)) !== 0
    )
    for (const overlay of group) {
      ordered.push({
        overlay,
        reason: !matching.includes(overlay)
          ? "surface-mismatch"
          : overlay !== first || ambiguous || seen.has(overlay.id)
            ? "duplicate-id"
            : undefined,
      })
    }
    if (first) {
      seen.add(first.id)
    }
  }
  return ordered
}
