import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import {
  opProperties,
  type OpProperty,
  type OpPropertyKey,
} from "./op-property"
import { orderOverlays } from "./order-overlays"
import { scopeKeyOf } from "./overlay-scope"
import { baseNodeIds, wrapCollides, type NodeIds } from "./wrap-ids"

export interface ResolvedOp {
  readonly check: Extract<OpCheck, { status: "valid" }>
  readonly overlay: LoadedOverlay
}

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
 * Why an op was skipped: its check status, `duplicate-id` when an overlay
 * earlier in the resolution order has the same id, or `surface-mismatch` when
 * the overlay is for another surface.
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
 * and `nothing-to-remove` means nothing was there. `id-collision` means a
 * `wrap` id is already used on the surface.
 */
export type UnappliedReason =
  "cross-layer-remove" | "id-collision" | "nothing-to-remove"

export interface UnappliedOp extends ResolvedOp {
  readonly reason: UnappliedReason
}

export interface ResolveLayersOptions {
  /**
   * Team ids, highest precedence first. Overlays from teams not listed rank
   * below the listed ones, and among themselves by ascending team id, so the
   * later id wins.
   */
  readonly teamOrder?: readonly string[] | undefined
}

export interface ResolvedLayers {
  readonly properties: ReadonlyMap<
    string,
    ReadonlyMap<OpPropertyKey, ResolvedProperty>
  >
  readonly skipped: readonly SkippedOp[]
  readonly unapplied: readonly UnappliedOp[]
}

interface Entry {
  winner: ResolvedOp
  history: ResolvedOp[]
  scope: string
  // The winner before `scope` first wrote, which a removal falls back to.
  baseline: ResolvedOp | undefined
  breakpoints?: Map<Breakpoint, ResolvedOp>
}

interface State {
  nodes: Map<string, Map<OpPropertyKey, Entry>>
  scopes: Map<LoadedOverlay, string>
  // Container address to item id to the address of the item placed there.
  placed: Map<string, Map<string, string>>
  inserts: Map<string, Set<string>>
}

function isRemoval(op: Op): boolean {
  return op.op === "remove" || op.op === "removeUserItem"
}

function entryAt(state: State, address: string, property: OpPropertyKey) {
  return state.nodes.get(address)?.get(property)
}

function write(
  state: State,
  { address, property, breakpoint }: OpProperty,
  resolved: ResolvedOp,
  scope: string
): void {
  let node = state.nodes.get(address)
  if (!node) {
    node = new Map()
    state.nodes.set(address, node)
  }
  const entry = node.get(property)
  if (!entry) {
    node.set(property, {
      winner: resolved,
      history: [resolved],
      scope,
      baseline: undefined,
      ...(breakpoint && { breakpoints: new Map([[breakpoint, resolved]]) }),
    })
    return
  }
  if (entry.scope !== scope) {
    entry.baseline = entry.winner
    entry.scope = scope
    entry.breakpoints?.clear()
  }
  if (breakpoint) {
    entry.breakpoints?.set(breakpoint, resolved)
  }
  entry.history.push(resolved)
  entry.winner = resolved
}

function remove(
  state: State,
  properties: readonly OpProperty[],
  resolved: ResolvedOp,
  scope: string
): UnappliedReason | undefined {
  let applied = false
  let foreign = false
  for (const { address, property } of properties) {
    const entry = entryAt(state, address, property)
    if (!entry || isRemoval(entry.winner.check.op)) {
      continue
    }
    if (state.scopes.get(entry.winner.overlay) !== scope) {
      foreign = true
      continue
    }
    entry.history.push(resolved)
    entry.winner = entry.baseline ?? resolved
    applied = true
  }
  return foreign
    ? "cross-layer-remove"
    : applied
      ? undefined
      : "nothing-to-remove"
}

function containerOf(state: State, address: string): string | undefined {
  const op = entryAt(state, address, "placement")?.winner.check.op
  if (op?.op === "move" && "into" in op.to) {
    return op.to.into
  }
  return op?.op === "wrap" ? op.id : undefined
}

// A wrapped item keeps its identity address: if a node with that id was moved
// or wrapped into the container and still sits there, that node's address.
function identityOf(state: State, container: string, item: string): string {
  const placed = state.placed.get(container)?.get(item)
  return placed !== undefined && containerOf(state, placed) === container
    ? placed
    : `${container}/slots/${item}`
}

function place(state: State, container: string, item: string, address: string) {
  let items = state.placed.get(container)
  if (!items) {
    items = new Map()
    state.placed.set(container, items)
  }
  items.set(item, address)
}

function nodeIds(state: State, base: ReadonlySet<string>): NodeIds {
  return {
    base,
    wrap: (id) => {
      const winner = entryAt(state, id, "inserted")?.winner
      const scope = winner && state.scopes.get(winner.overlay)
      return winner?.check.op.op === "wrap" && scope !== undefined
        ? { scope, target: winner.check.op.target }
        : undefined
    },
    isInserted: (id) =>
      [...(state.inserts.get(id) ?? [])].some(
        (address) =>
          entryAt(state, address, "inserted")?.winner.check.op.op === "insert"
      ),
  }
}

function apply(
  state: State,
  ids: NodeIds,
  resolved: ResolvedOp,
  scope: string
): UnappliedReason | undefined {
  const { op } = resolved.check
  if (isRemoval(op)) {
    return remove(state, opProperties(op), resolved, scope)
  }
  if (op.op === "wrap" && wrapCollides(op, scope, ids)) {
    return "id-collision"
  }
  const identities = new Map<string, string>()
  const properties = opProperties(op, (container, item) => {
    const address = identityOf(state, container, item)
    identities.set(item, address)
    return address
  })
  for (const property of properties) {
    write(state, property, resolved, scope)
  }
  if (op.op === "move" && "into" in op.to) {
    const item = op.target.slice(op.target.lastIndexOf("/") + 1)
    place(state, op.to.into, item, op.target)
  } else if (op.op === "wrap") {
    for (const [item, address] of identities) {
      place(state, op.id, item, address)
    }
  } else if (op.op === "insert") {
    let addresses = state.inserts.get(op.node.id)
    if (!addresses) {
      addresses = new Set()
      state.inserts.set(op.node.id, addresses)
    }
    addresses.add(`${op.target}/slots/${op.node.id}`)
  }
  return undefined
}

function settle(entry: Entry): ResolvedProperty {
  const { winner, breakpoints } = entry
  const live = new Set(breakpoints?.values() ?? [winner])
  return {
    winner,
    ...(breakpoints && {
      breakpoints: new Map(
        breakpointSchema.options.flatMap((breakpoint) => {
          const op = breakpoints.get(breakpoint)
          return op ? [[breakpoint, op] as const] : []
        })
      ),
    }),
    overridden: entry.history.filter((op) => !live.has(op)),
  }
}

/**
 * Resolves the overlays for one surface, plus the @app overlays, into a value
 * per (address, property).
 *
 * Layers apply org, team, personal, session. Within a layer, overlays apply
 * by `teamOrder` (team layer only), then ascending scope id, `createdAt` and
 * overlay id, so the later one wins; within an overlay, later ops win.
 *
 * Only valid ops apply. `skipped` lists the ops that aren't valid, the ops of
 * an overlay whose id appeared earlier in this order, and the ops of an
 * overlay for another surface than the first non-@app overlay's. `unapplied`
 * lists valid ops that didn't apply; a `removeUserItem` that removed part of
 * what it names also appears there. Both lists follow the resolution order.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { teamOrder = [] }: ResolveLayersOptions = {}
): ResolvedLayers {
  const ordered = orderOverlays(overlays, teamOrder)
  const state: State = {
    nodes: new Map(),
    scopes: new Map(),
    placed: new Map(),
    inserts: new Map(),
  }
  const rejected = new Map<LoadedOverlay, "duplicate-id" | "surface-mismatch">()
  const seen = new Set<string>()
  let surface: string | undefined
  for (const overlay of ordered) {
    if (seen.has(overlay.id)) {
      rejected.set(overlay, "duplicate-id")
      continue
    }
    seen.add(overlay.id)
    if (overlay.surface !== "@app") {
      surface ??= overlay.surface
      if (overlay.surface !== surface) {
        rejected.set(overlay, "surface-mismatch")
        continue
      }
    }
    state.scopes.set(overlay, scopeKeyOf(overlay))
  }
  const ids = nodeIds(
    state,
    baseNodeIds(
      ordered.flatMap((overlay) =>
        rejected.has(overlay)
          ? []
          : overlay.ops.flatMap((check) =>
              check.status === "valid" ? [check.op] : []
            )
      )
    )
  )
  const skipped: SkippedOp[] = []
  const unapplied: UnappliedOp[] = []
  for (const overlay of ordered) {
    const reason = rejected.get(overlay)
    const scope = state.scopes.get(overlay)
    for (const check of overlay.ops) {
      if (reason) {
        skipped.push({ check, overlay, reason })
      } else if (check.status !== "valid") {
        skipped.push({ check, overlay, reason: check.status })
      } else if (scope !== undefined) {
        const notApplied = apply(state, ids, { check, overlay }, scope)
        if (notApplied) {
          unapplied.push({ check, overlay, reason: notApplied })
        }
      }
    }
  }
  const properties = new Map<string, Map<OpPropertyKey, ResolvedProperty>>()
  for (const [address, node] of state.nodes) {
    const settled = new Map<OpPropertyKey, ResolvedProperty>()
    for (const [property, entry] of node) {
      settled.set(property, settle(entry))
    }
    properties.set(address, settled)
  }
  return { properties, skipped, unapplied }
}
