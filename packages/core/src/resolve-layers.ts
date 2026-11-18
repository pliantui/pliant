import type { Breakpoint } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { scopeKeyOf } from "./overlay-scope"
import type { ResolvedPlacement } from "./placement"
import { applyOp, createResolution, settleResolution } from "./resolution"
import { surfaceOrder } from "./surface-order"

/** A valid op that applied, with the overlay it came from. */
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

/** A valid op that didn't apply, and why. */
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
   * The surface's known node ids, from the `pliantui scan` inventory. When
   * given, they are exactly the base nodes: an `insert` or `wrap` collides
   * with a base node only if its id is listed.
   *
   * When omitted, a base node is approximated as an id some op pointed at,
   * in resolution order, before any insert or wrap created it. That guess is
   * meant only for using core directly; Pliant's runtime always passes ids.
   */
  readonly baseIds?: ReadonlySet<string> | readonly string[] | undefined
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
 *
 * Throws a `TypeError` when `surface` isn't a string.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { surface, baseIds, teamOrder = [] }: ResolveLayersOptions
): ResolvedLayers {
  const state = createResolution(baseIds)
  const skipped: SkippedOp[] = []
  const unapplied: UnappliedOp[] = []
  for (const { overlay, reason } of surfaceOrder(
    overlays,
    surface,
    teamOrder
  )) {
    const scope = scopeKeyOf(overlay)
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
  return { properties: settleResolution(state), skipped, unapplied }
}
