import type { Breakpoint } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import { compareData } from "./compare-data"
import type { LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { contentOf, orderOverlays } from "./order-overlays"
import { scopeKeyOf } from "./overlay-scope"
import type { ResolvedPlacement } from "./placement"
import { applyOp, createResolution, settleResolution } from "./resolution"

export interface ResolvedOp {
  readonly check: Extract<OpCheck, { status: "valid" }>
  readonly overlay: LoadedOverlay
}

export interface ResolvedProperty {
  /**
   * The op that decides the value. A `remove` or `removeUserItem` winner
   * means the item is absent. On `placement`, a `wrap` or `remove` winner
   * can also be the op that sent the item back from its wrap (see
   * `placement`).
   */
  readonly winner: ResolvedOp
  /**
   * Set for `placement` only: where the item sits. When a wrap is replaced
   * without an item, or removed, the item goes back to its placement from
   * before the wrap's scope placed it; with no such placement, it goes back
   * to the wrap's target with no position, and the replacing wrap or the
   * removal is the winner.
   */
  readonly placement?: ResolvedPlacement
  /**
   * Set for `layout` and `span` only: the winning scope's op at each
   * breakpoint it sets, in breakpoint order. A scope that sets any breakpoint
   * replaces every breakpoint set before it by another scope.
   */
  readonly breakpoints?: ReadonlyMap<Breakpoint, ResolvedOp>
  /**
   * Every other op applied to the property, in the order applied (lowest
   * precedence first). After a removal, the winner can be an op applied
   * before some of these.
   */
  readonly overridden: readonly ResolvedOp[]
}

/**
 * Why an op was skipped: its check status, `duplicate-id` when its overlay
 * shares its id with an overlay earlier in the resolution order, or with one
 * that ties with it on every sort key but has other contents, or
 * `surface-mismatch` when the overlay is for another surface.
 */
export type SkippedOp =
  | {
      readonly check: Exclude<OpCheck, { status: "valid" }>
      readonly overlay: LoadedOverlay
      readonly reason: Exclude<OpCheck["status"], "valid">
    }
  | {
      readonly check: OpCheck
      readonly overlay: LoadedOverlay
      readonly reason: "duplicate-id" | "surface-mismatch"
    }

/**
 * Why a valid op didn't apply. `remove` and `removeUserItem` only clear what
 * their own scope added: `cross-layer-remove` means another scope added it,
 * and `nothing-to-remove` means nothing was there. `id-collision` means the id
 * an `insert` or `wrap` creates is already used on the surface: by a live
 * inserted node (unless an insert replaces one at the same target), a live
 * wrapper (unless its own scope replaces it at the same target), a base node
 * an earlier op pointed at, or a node the op itself points at.
 */
export type UnappliedReason =
  "cross-layer-remove" | "id-collision" | "nothing-to-remove"

export interface UnappliedOp extends ResolvedOp {
  readonly reason: UnappliedReason
}

export interface ResolveLayersOptions {
  /**
   * The surface to resolve. Overlays for any other surface, except `@app`,
   * are skipped with `surface-mismatch`.
   */
  readonly surface: string
  /**
   * Team ids, highest precedence first. Overlays from teams not listed rank
   * below the listed ones, and among themselves by ascending team id, so the
   * later id wins.
   */
  readonly teamOrder?: readonly string[] | undefined
}

export interface ResolvedLayers {
  /**
   * The resolved properties by identity, then property key. The identity is a
   * node's bare id (`<parent>/slots/<id>` and `<id>` are the same node), an
   * item's address on its node (`orders-table/columns/notes`), or `@surface`
   * or `@app`.
   */
  readonly properties: ReadonlyMap<
    string,
    ReadonlyMap<OpPropertyKey, ResolvedProperty>
  >
  /** Ops that weren't resolved, in resolution order. */
  readonly skipped: readonly SkippedOp[]
  /** Valid ops that didn't apply, in resolution order. */
  readonly unapplied: readonly UnappliedOp[]
}

type Rejection = "duplicate-id" | "surface-mismatch"

// The overlays each result applied, in order, so `validateOverlay` can apply
// an overlay on top exactly as resolution would.
const applied = new WeakMap<ResolvedLayers, readonly LoadedOverlay[]>()

/** The overlays `resolved` applied, in resolution order. */
export function appliedOverlaysOf(
  resolved: ResolvedLayers
): readonly LoadedOverlay[] {
  return applied.get(resolved) ?? []
}

function rejectionsOf(
  groups: readonly (readonly LoadedOverlay[])[],
  surface: string
): Map<LoadedOverlay, Rejection> {
  const rejected = new Map<LoadedOverlay, Rejection>()
  const seen = new Set<string>()
  for (const group of groups) {
    const matching = group.filter(
      (overlay) => overlay.surface === surface || overlay.surface === "@app"
    )
    for (const overlay of group) {
      if (!matching.includes(overlay)) {
        rejected.set(overlay, "surface-mismatch")
      }
    }
    const [first, ...rest] = matching
    if (!first) {
      continue
    }
    const content = contentOf(first)
    const ambiguous = rest.some(
      (overlay) => compareData(content, contentOf(overlay)) !== 0
    )
    for (const overlay of matching) {
      if (overlay !== first || ambiguous || seen.has(overlay.id)) {
        rejected.set(overlay, "duplicate-id")
      }
    }
    seen.add(first.id)
  }
  return rejected
}

/**
 * Resolves the overlays for one surface, plus the @app overlays, into a value
 * per (identity, property).
 *
 * Layers apply org, team, personal, session. Within a layer, overlays apply
 * by `teamOrder` (team layer only), then ascending scope id, `createdAt` and
 * overlay id, so the later one wins; within an overlay, later ops win.
 *
 * Only valid ops apply. `skipped` lists the ops that aren't valid, the ops of
 * an overlay for another surface, and the ops of an overlay whose id is
 * already used: the first overlay with an id in this order is used, unless
 * overlays tie with it on every sort key. Tied overlays with identical
 * contents keep the first in input order; tied overlays with other contents
 * are all skipped. `unapplied` lists valid ops that didn't apply; a
 * `removeUserItem` that removed part of what it names also appears there.
 * Both lists follow the resolution order.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { surface, teamOrder = [] }: ResolveLayersOptions
): ResolvedLayers {
  const groups = orderOverlays(overlays, teamOrder)
  const rejected = rejectionsOf(groups, surface)
  const state = createResolution()
  const accepted: LoadedOverlay[] = []
  const skipped: SkippedOp[] = []
  const unapplied: UnappliedOp[] = []
  for (const overlay of groups.flat()) {
    const reason = rejected.get(overlay)
    const scope = scopeKeyOf(overlay)
    if (!reason) {
      accepted.push(overlay)
    }
    for (const check of overlay.ops) {
      if (reason) {
        skipped.push({ check, overlay, reason })
      } else if (check.status !== "valid") {
        skipped.push({ check, overlay, reason: check.status })
      } else {
        const notApplied = applyOp(state, { check, overlay }, scope)
        if (notApplied) {
          unapplied.push({ check, overlay, reason: notApplied })
        }
      }
    }
  }
  const result = {
    properties: settleResolution(state),
    skipped,
    unapplied,
  }
  applied.set(result, accepted)
  return result
}
