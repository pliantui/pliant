import type { Breakpoint } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import { scopeKeyOf } from "./overlay-scope"
import type { ResolvedPlacement } from "./placement"
import {
  applyOp,
  createResolution,
  readBaseIds,
  settleResolution,
} from "./resolution"
import { surfaceOrder } from "./surface-order"

/**
 * Where an item sits, for every item a placement op (`move`, `pin`,
 * `promote`, `demote`, or wrap membership) touched, and for every live node
 * an op created in a node that was removed since.
 *
 * It is the latest placement whose container still exists in the version it
 * had when the item was placed there. Creating a node again, or replacing a
 * wrap, makes a new version, so an item never returns into an earlier one.
 * So when a wrapper is removed, or re-wrapped without an item, every item in
 * it (listed by the wrap, or pinned, reordered or moved into it later) goes
 * back to the placement it had just before it entered the wrapper. An item
 * the re-wrap lists is placed by the re-wrap, which replaces any earlier pin
 * or reorder inside the wrapper.
 *
 * With no placement left, the item is in its base parent with no position
 * and no `winner`. The base parent is where an `insert` or `wrap` created
 * the item (a wrapper's own target), else the parent in the address of the
 * first op that placed it, in resolution order: if a team pins
 * `sidebar/slots/a` and a personal overlay pins `dashboard/slots/a`, `a` stays
 * in `sidebar`. A node created again starts over in its new base parent.
 * The parent an item was created in isn't versioned, so an item created in
 * a node that is later created again goes back into it.
 * When the base parent is a node that was removed, the item sits where that
 * node would, up the chain; with no live node left, as in a cycle of removed
 * nodes, it sits on `@surface`. Ops that create a container cycle aren't
 * rejected.
 *
 * A `pin`, reorder, `promote` or `demote` applied while the item has no
 * placement that holds and its base parent is a removed node follows the
 * base: it always holds, and positions the item wherever its base parent
 * chain resolves once every op has applied, even if that changes later.
 * Later position ops on the item follow the base too, until a `move … into`
 * or wrap places it. Such a pin isn't tied to the base parent's version.
 */
export interface ResolvedItemPlacement extends ResolvedPlacement {
  /** The placement op that holds, absent when none does. */
  readonly winner?: ResolvedOp
  /** Every other placement op applied to the item, in the order applied. */
  readonly overridden: readonly ResolvedOp[]
}

/** A valid op that applied, with the overlay it came from. */
export interface ResolvedOp {
  readonly check: Extract<OpCheck, { status: "valid" }>
  readonly overlay: LoadedOverlay
}

/** The resolved value of one property of one node or item. */
export interface ResolvedProperty {
  /**
   * The op that decides the value. A `remove` or `removeUserItem` winner
   * means the item is absent.
   */
  readonly winner: ResolvedOp
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
 * Why an op was skipped: its check status, `extension-not-installed` for an
 * unknown op with a namespaced name, `duplicate-id` when its overlay
 * shares its id with an overlay earlier in the resolution order, or with one
 * that ties with it on every sort key but has other contents, or
 * `surface-mismatch` when the overlay is for another surface.
 */
export type SkippedOp =
  | {
      readonly check: Extract<OpCheck, { status: "unknown" }>
      readonly overlay: LoadedOverlay
      readonly reason: "unknown" | "extension-not-installed"
    }
  | {
      readonly check: Extract<OpCheck, { status: "newer" }>
      readonly overlay: LoadedOverlay
      readonly reason: "newer"
    }
  | {
      readonly check: Extract<OpCheck, { status: "invalid" }>
      readonly overlay: LoadedOverlay
      readonly reason: "invalid"
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
 * wrapper (unless its own scope replaces it at the same target), a base
 * node, or a node the op itself points at. With `baseIds`, a base node is
 * exactly a listed id; without them, it is approximated as an id an earlier
 * op in the resolution order pointed at before anything created it.
 * `missing-container` means a `move … into` names a node, or an `insert` or
 * `wrap` targets one, that doesn't exist when it applies: one that was
 * removed, or, with inventory `baseIds`, one that is neither listed,
 * created, nor the item's own base parent. With mounted `baseIds`, such an
 * unlisted node that was never removed may just not be mounted yet, so the
 * op is `dormant` instead: it applies once the caller resolves again with
 * the node in `baseIds`.
 */
export type UnappliedReason =
  | "cross-layer-remove"
  | "dormant"
  | "id-collision"
  | "missing-container"
  | "nothing-to-remove"

/** A valid op that didn't apply, and why. */
export interface UnappliedOp extends ResolvedOp {
  readonly reason: UnappliedReason
}

/**
 * The surface's known node ids, and where they come from: `"inventory"` for
 * the full `pliantui scan` inventory, where an unlisted node doesn't exist,
 * or `"mounted"` for the nodes mounted now (such as `PliantRegion` slot
 * keys), where an unlisted node may mount later, so an op that needs it is
 * `dormant` rather than `missing-container`.
 */
export interface BaseIds {
  readonly ids: ReadonlySet<string> | readonly string[]
  readonly source: "inventory" | "mounted"
}

/** What `resolveLayers` resolves for, and how. */
export interface ResolveLayersOptions {
  /**
   * The surface to resolve. Overlays for any other surface, except `@app`,
   * are skipped with `surface-mismatch`.
   */
  readonly surface: string
  /**
   * The surface's known node ids. When given, they are exactly the base
   * nodes: an `insert` or `wrap` collides with a base node only if its id is
   * listed. A bare set or array of ids is the full inventory, the same as
   * `{ ids, source: "inventory" }`.
   *
   * With `"inventory"`, an op into an unlisted node that was never created
   * is `missing-container`. With `"mounted"`, it is `dormant`: it applies
   * once the node mounts and the caller resolves again with it listed. An
   * op into a removed node is `missing-container` either way.
   *
   * When omitted, a base node is approximated as an id some op pointed at,
   * in resolution order, before any insert or wrap created it, and an
   * unknown container counts as a base node. That guess is meant only for
   * using core directly; Pliant's runtime always passes ids.
   */
  readonly baseIds?:
    BaseIds | ReadonlySet<string> | readonly string[] | undefined
  /**
   * Team ids, highest precedence first. Overlays from teams not listed rank
   * below the listed ones, and among themselves by ascending team id, so the
   * later id wins.
   */
  readonly teamOrder?: readonly string[] | undefined
}

/** The result of `resolveLayers`. */
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
  /**
   * Where each item sits, by identity, for every item a placement op
   * touched. Placement resolves apart from `properties`, since an item can
   * end up with no op deciding it.
   */
  readonly placements: ReadonlyMap<string, ResolvedItemPlacement>
  /** Ops that weren't resolved, in resolution order. */
  readonly skipped: readonly SkippedOp[]
  /** Valid ops that didn't apply, in resolution order. */
  readonly unapplied: readonly UnappliedOp[]
  /**
   * The overlays in resolution order, skipped ones included. Ops apply in
   * this order, then by their index in the overlay.
   */
  readonly overlays: readonly LoadedOverlay[]
  /**
   * The `baseIds` resolution used, read as `{ ids, source }`, if given. The
   * ids are a set copied when resolving, so changing the caller's ids
   * afterwards doesn't change them.
   */
  readonly baseIds: BaseIds | undefined
}

/**
 * Resolves the overlays for one surface, plus the @app overlays, into a value
 * per (identity, property) in `properties`, and where each placed item sits
 * in `placements`.
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
 * Throws a `TypeError` when `surface` isn't a string, or `baseIds` isn't
 * node ids or `{ ids, source }`.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { surface, baseIds, teamOrder = [] }: ResolveLayersOptions
): ResolvedLayers {
  const read = readBaseIds(baseIds)
  const known: BaseIds | undefined = read && {
    ids: new Set(read.ids),
    source: read.source,
  }
  const state = createResolution(known)
  const skipped: SkippedOp[] = []
  const unapplied: UnappliedOp[] = []
  const ordered = surfaceOrder(overlays, surface, teamOrder)
  for (const { overlay, reason } of ordered) {
    const scope = scopeKeyOf(overlay)
    for (const check of overlay.ops) {
      if (reason) {
        skipped.push({ check, overlay, reason })
      } else if (check.status === "unknown") {
        skipped.push({
          check,
          overlay,
          reason: check.extension ? "extension-not-installed" : "unknown",
        })
      } else if (check.status === "newer") {
        skipped.push({ check, overlay, reason: "newer" })
      } else if (check.status === "invalid") {
        skipped.push({ check, overlay, reason: "invalid" })
      } else {
        const notApplied = applyOp(state, { check, overlay }, scope)
        if (notApplied) {
          unapplied.push({ check, overlay, reason: notApplied })
        }
      }
    }
  }
  return {
    ...settleResolution(state),
    skipped,
    unapplied,
    overlays: ordered.map(({ overlay }) => overlay),
    baseIds: known,
  }
}
