import type { Breakpoint, Flags } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import type { ResolvedPlacement } from "./placement"
import { readBaseParents } from "./read-base-parents"
import { readFlags } from "./read-flags"
import { readBaseIds } from "./resolution"
import { resolveOrdered } from "./resolve-ordered"
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
 * that ties with it on every sort key but has other contents,
 * `surface-mismatch` when the overlay is for another surface, or
 * `guardrail` when the valid op would break a guardrail (see `flags` in
 * `ResolveLayersOptions`).
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
   * A valid op skipped because it would break a guardrail. Every guardrail
   * skip names the flagged node the rule protects and the flag that makes
   * it protected.
   */
  | {
      readonly check: Extract<OpCheck, { status: "valid" }>
      readonly overlay: LoadedOverlay
      readonly reason: "guardrail"
      /**
       * The rule the op would break, named after what it enforces:
       * `stays-visible` keeps nodes flagged `critical` or `required` visible
       * and reachable.
       */
      readonly guardrail: "stays-visible"
      /** The flag of `node` that the rule protects. */
      readonly flag: "critical" | "required"
      /** The identity of the flagged node or item the rule protects. */
      readonly node: string
      /**
       * The ops applied before this one that make it break the rule, such
       * as the `move … into` the node this op hides. Empty when the op
       * breaks it alone.
       */
      readonly conflictsWith: readonly ResolvedOp[]
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
 * every node in your app's component tree, where an unlisted node doesn't
 * exist,
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
  /**
   * The surface's instance flags, by address, such as
   * `{ "page/slots/checkout-actions/slots/pay-now": { critical: true } }`. A
   * form field's address is its item address, such as
   * `page/slots/ticket-form/fields/email`. Addresses of the same node
   * combine their flags.
   *
   * A node or item flagged `critical` or `required` stays visible and
   * reachable: no `hide`, `collapse`, `demote` or `remove` on it or on a
   * node that holds it, and no `move … into`, `wrap` or other op that puts
   * it in a hidden node or a cycle of containers.
   *
   * Ops apply one at a time in resolution order. Each op that leaves a
   * flagged node out of sight, given the ops kept before it, is skipped
   * with reason `guardrail` and guardrail `stays-visible`; every op before
   * it was kept, so it is the op from the highest layer involved. An op is
   * judged by the ops before it only: a lower layer's `hide` is skipped even
   * when a higher layer's `show` would undo it.
   *
   * Each op that can hide something checks the state so far, and each
   * skipped op applies the ops kept before it again, so the time grows with
   * the number of ops times the number of ops that can hide something; ops
   * such as sorts and widths add nothing.
   *
   * Which node holds another in the page comes from `baseParents` when
   * given. Without it, it comes from the addresses in `flags`, then from
   * the targets and `move … into` destinations of the ops, so give flags by
   * full address. A node named only by its id is then not traced to the
   * nodes that hold it, for example `drawer` in `move … into drawer` or in
   * the `items` of a `collapse`.
   */
  readonly flags?: Readonly<Record<string, Flags>> | undefined
  /**
   * The surface's node tree, from your app's component tree: each node id
   * mapped to the id of the node that holds it, or `null` for a node at the
   * top of the surface, such as `{ page: null, "pay-now": "page" }`.
   * When given, it is the only source of which node holds another in the
   * page; addresses in overlays don't change it. An item's node always
   * comes from its address.
   *
   * A node it leaves out, such as one not mounted yet, takes the parent its
   * flag's address shows. It must put each node a flag's address names in
   * the parent that address shows, and, with those parents, have no cycle.
   */
  readonly baseParents?: Readonly<Record<string, string | null>> | undefined
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
 * are all skipped, and so are valid ops that would break a guardrail (see
 * `flags`). `unapplied` lists valid ops that didn't apply; a
 * `removeUserItem` that removed part of what it names also appears there.
 * Both lists follow the resolution order.
 *
 * Throws a `TypeError` when `surface` isn't a string, `baseIds` isn't node
 * ids or `{ ids, source }`, `flags` isn't a plain object that maps
 * addresses to valid flags, two of its addresses put one node in different
 * parents, or `baseParents` isn't a plain object that maps node ids to
 * node ids or `null`, puts a node in another parent than a flag's address
 * shows, or has a cycle.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { surface, baseIds, teamOrder = [], flags, baseParents }: ResolveLayersOptions
): ResolvedLayers {
  const read = readBaseIds(baseIds)
  const known: BaseIds | undefined = read && {
    ids: new Set(read.ids),
    source: read.source,
  }
  const ordered = surfaceOrder(overlays, surface, teamOrder)
  const flagged = readFlags(flags)
  return {
    ...resolveOrdered(
      ordered,
      known,
      flagged,
      readBaseParents(baseParents, flagged)
    ),
    overlays: ordered.map(({ overlay }) => overlay),
    baseIds: known,
  }
}
