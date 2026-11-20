import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import { identityOf, parentOf } from "./node-identity"
import { referencedNodes } from "./node-ids"
import {
  opProperties,
  type OpProperty,
  type OpPropertyKey,
} from "./op-property"
import { placementOf, type ResolvedPlacement } from "./placement"
import type {
  BaseIds,
  ResolvedItemPlacement,
  ResolvedOp,
  ResolvedProperty,
  ResolveLayersOptions,
  UnappliedReason,
} from "./resolve-layers"

interface Contribution {
  readonly op: ResolvedOp
  readonly scope: string
}

interface Entry {
  winner: Contribution
  history: ResolvedOp[]
  scope: string
  // The winner before `scope` first wrote, which a removal falls back to.
  baseline: Contribution | undefined
  breakpoints?: Map<Breakpoint, ResolvedOp>
}

interface Placed {
  readonly op: ResolvedOp
  readonly placement: ResolvedPlacement
  // The container's version when the op placed the item. It can be undefined
  // only when the placement follows the base, which doesn't use it.
  readonly version: number | undefined
  // Set when the op applied while the item's base parent was removed: the
  // item is positioned in whatever its base parent resolves to at the end.
  readonly followsBase?: true
}

interface Placements {
  readonly history: ResolvedOp[]
  // Placements that may still hold, latest last. A placement whose container
  // has moved on to another version never holds again, so it is dropped.
  readonly candidates: Placed[]
  // The item's container before any op placed it: where an op created it,
  // else the parent in the address it was first placed from. Creating the
  // item again resets it.
  origin: string
}

/** The state of a resolution, which ops apply to one at a time in order. */
export interface Resolution {
  readonly nodes: Map<string, Map<OpPropertyKey, Entry>>
  readonly placements: Map<string, Placements>
  // Ids an insert or wrap has created so far.
  readonly created: Set<string>
  // The base node ids: exactly the ones given, or else the ids an op pointed
  // at before anything created them.
  readonly base: Set<string>
  readonly exactBase: boolean
  // The base ids are only the nodes mounted now, so an unknown container may
  // still mount: an op into it is dormant, not missing.
  readonly mounted: boolean
  // Created node id to its version, which changes each time the node is
  // created again or its wrap is replaced.
  readonly versions: Map<string, number>
  // Created node id to where it was last created, kept after a removal.
  readonly createdIn: Map<string, string>
}

function isIdList(
  ids: unknown
): ids is ReadonlySet<string> | readonly string[] {
  return Array.isArray(ids) || ids instanceof Set
}

/**
 * Reads `baseIds` as `{ ids, source }`: a bare set or array of ids is the
 * full inventory. Throws a `TypeError` for anything else.
 */
export function readBaseIds(baseIds: unknown): BaseIds | undefined {
  if (baseIds === undefined) {
    return undefined
  }
  if (isIdList(baseIds)) {
    return { ids: baseIds, source: "inventory" }
  }
  if (typeof baseIds === "object" && baseIds !== null && "ids" in baseIds) {
    const { ids } = baseIds
    const source = "source" in baseIds ? baseIds.source : undefined
    if (isIdList(ids) && (source === "inventory" || source === "mounted")) {
      return { ids, source }
    }
  }
  throw new TypeError(
    'baseIds must be node ids, or { ids, source: "inventory" | "mounted" }'
  )
}

export function createResolution(
  baseIds?: ResolveLayersOptions["baseIds"]
): Resolution {
  const read = readBaseIds(baseIds)
  return {
    nodes: new Map(),
    placements: new Map(),
    created: new Set(),
    base: new Set<string>(read?.ids),
    exactBase: read !== undefined,
    mounted: read?.source === "mounted",
    versions: new Map(),
    createdIn: new Map(),
  }
}

function isRemoval(op: Op): boolean {
  return op.op === "remove" || op.op === "removeUserItem"
}

function entryAt(state: Resolution, address: string, property: OpPropertyKey) {
  return state.nodes.get(address)?.get(property)
}

function liveNode(state: Resolution, id: string): Contribution | undefined {
  const winner = entryAt(state, id, "inserted")?.winner
  return winner && !isRemoval(winner.op.check.op) ? winner : undefined
}

function isRemoved(state: Resolution, id: string): boolean {
  return entryAt(state, id, "inserted") !== undefined && !liveNode(state, id)
}

// Where an item with no placement that holds sits when every node above it
// is gone: the surface itself.
const surfaceRoot = "@surface"

/**
 * The version of the node `id` as a container, or undefined while it doesn't
 * exist: a node an op created is live until it is removed, and a base node
 * is always version 0. So is `parent`, the item's own base parent, which its
 * address shows exists even when `baseIds` doesn't list it.
 */
function versionOf(
  state: Resolution,
  id: string,
  parent?: string
): number | undefined {
  if (entryAt(state, id, "inserted")) {
    return liveNode(state, id) ? state.versions.get(id) : undefined
  }
  return state.base.has(id) || id === parent ? 0 : undefined
}

function holds(
  state: Resolution,
  { origin }: Placements,
  { placement, version, followsBase }: Placed
): boolean {
  return (
    followsBase === true ||
    versionOf(state, placement.container, origin) === version
  )
}

// Dropping is permanent: a version only grows, so a placement that stops
// holding never holds again. Each placement is dropped at most once.
function currentPlacement(
  state: Resolution,
  placements: Placements | undefined
): Placed | undefined {
  const candidates = placements?.candidates ?? []
  let top = candidates.at(-1)
  while (placements && top && !holds(state, placements, top)) {
    candidates.pop()
    top = candidates.at(-1)
  }
  return top
}

function baseParentOf(state: Resolution, id: string): string | undefined {
  return state.createdIn.get(id) ?? state.placements.get(id)?.origin
}

/**
 * The container an item sits in when no placement of its own holds: its
 * base parent, or, when that node was removed, where that node sits, up the
 * chain. With no node left in the chain, as in a cycle of removed nodes, it
 * is the surface. `memo` maps removed nodes to the container their items go
 * to, so a resolved chain is walked once.
 */
function baseContainer(
  state: Resolution,
  id: string,
  memo: Map<string, string>
): string | undefined {
  let node = baseParentOf(state, id)
  const path: string[] = []
  const seen = new Set<string>()
  while (
    node !== undefined &&
    isRemoved(state, node) &&
    !memo.has(node) &&
    !seen.has(node)
  ) {
    seen.add(node)
    path.push(node)
    const held = currentPlacement(state, state.placements.get(node))
    node =
      held && !held.followsBase
        ? held.placement.container
        : baseParentOf(state, node)
  }
  if (node === undefined) {
    return undefined
  }
  const container =
    memo.get(node) ?? (isRemoved(state, node) ? surfaceRoot : node)
  for (const removed of path) {
    memo.set(removed, container)
  }
  return container
}

function place(
  state: Resolution,
  op: Op,
  address: string,
  resolved: ResolvedOp
): void {
  let placements = state.placements.get(address)
  if (!placements) {
    placements = {
      history: [],
      candidates: [],
      origin:
        state.createdIn.get(address) ??
        (op.op === "wrap" ? identityOf(op.target) : parentOf(op.target)),
    }
    state.placements.set(address, placements)
  }
  const sets = op.op === "wrap" || (op.op === "move" && "into" in op.to)
  const held = sets ? undefined : currentPlacement(state, placements)
  const parent = baseParentOf(state, address)
  const followsBase =
    !sets &&
    (held
      ? held.followsBase === true
      : parent !== undefined && isRemoved(state, parent))
  const placement = placementOf(
    op,
    address,
    held && !held.followsBase ? held.placement.container : parent
  )
  if (placement) {
    placements.history.push(resolved)
    placements.candidates.push({
      op: resolved,
      placement,
      version: versionOf(state, placement.container, placements.origin),
      ...(followsBase && { followsBase }),
    })
  }
}

// The container a `move … into`, `insert` or `wrap` needs, when it doesn't
// exist. A node exists when it is a base node, created and live, or the
// item's own base parent. Without `baseIds` an unknown id counts as a base
// node, so only a removed one is absent.
function absentContainer(state: Resolution, op: Op): string | undefined {
  if (op.op === "insert" || op.op === "wrap") {
    // The created node's own earlier base parent, and a wrap's items' base
    // parents, count as existing, as for a move.
    const parents = [
      baseParentOf(state, op.op === "insert" ? op.node.id : op.id),
      ...(op.op === "wrap"
        ? op.items.map((item) => baseParentOf(state, item))
        : []),
    ]
    const target = identityOf(op.target)
    return parents.every(
      (parent) => versionOf(state, target, parent) === undefined
    )
      ? target
      : undefined
  }
  if (op.op !== "move" || !("into" in op.to)) {
    return undefined
  }
  const into = identityOf(op.to.into)
  const item = identityOf(op.target)
  return versionOf(
    state,
    into,
    baseParentOf(state, item) ?? parentOf(op.target)
  ) === undefined
    ? into
    : undefined
}

/**
 * Why an op can't apply into its container: `missing-container` when the
 * container was removed, or `baseIds` is the full inventory and doesn't list
 * it; `dormant` when `baseIds` lists only mounted nodes, so the container may
 * mount later.
 */
function containerReason(
  state: Resolution,
  op: Op
): "dormant" | "missing-container" | undefined {
  const container = absentContainer(state, op)
  if (container === undefined) {
    return undefined
  }
  return state.mounted && !isRemoved(state, container)
    ? "dormant"
    : "missing-container"
}

function write(
  state: Resolution,
  address: string,
  property: OpPropertyKey,
  breakpoint: Breakpoint | undefined,
  contribution: Contribution
): void {
  let node = state.nodes.get(address)
  if (!node) {
    node = new Map()
    state.nodes.set(address, node)
  }
  const { op, scope } = contribution
  const entry = node.get(property)
  if (!entry) {
    node.set(property, {
      winner: contribution,
      history: [op],
      scope,
      baseline: undefined,
      ...(breakpoint && { breakpoints: new Map([[breakpoint, op]]) }),
    })
    return
  }
  if (entry.scope !== scope) {
    entry.baseline = entry.winner
    entry.scope = scope
    entry.breakpoints?.clear()
  }
  if (breakpoint) {
    entry.breakpoints?.set(breakpoint, op)
  }
  entry.history.push(op)
  entry.winner = contribution
}

function remove(
  state: Resolution,
  properties: readonly OpProperty[],
  removal: Contribution
): UnappliedReason | undefined {
  let applied = false
  let foreign = false
  for (const { address, property } of properties) {
    const entry =
      property === "placement" ? undefined : entryAt(state, address, property)
    if (!entry || isRemoval(entry.winner.op.check.op)) {
      continue
    }
    if (entry.winner.scope !== removal.scope) {
      foreign = true
      continue
    }
    entry.history.push(removal.op)
    entry.winner = entry.baseline ?? removal
    applied = true
  }
  return foreign
    ? "cross-layer-remove"
    : applied
      ? undefined
      : "nothing-to-remove"
}

/**
 * Whether the id an `insert` or `wrap` creates is taken. Node ids are unique
 * on the surface: an insert may only replace an insert at the same target,
 * and a wrap only its own scope's wrap at the same target.
 */
function collides(
  state: Resolution,
  op: Extract<Op, { op: "insert" | "wrap" }>,
  scope: string
): boolean {
  const id = op.op === "insert" ? op.node.id : op.id
  if (referencedNodes(op).includes(id)) {
    return true
  }
  const live = liveNode(state, id)
  if (!live) {
    return state.base.has(id)
  }
  const other = live.op.check.op
  return (
    other.op !== op.op ||
    identityOf(other.target) !== identityOf(op.target) ||
    (op.op === "wrap" && live.scope !== scope)
  )
}

/**
 * Applies one valid op for `scope`, or returns why it didn't apply. Applying
 * an op of an earlier overlay in the resolution order first is up to the
 * caller.
 */
export function applyOp(
  state: Resolution,
  resolved: ResolvedOp,
  scope: string
): UnappliedReason | undefined {
  const { op } = resolved.check
  if (!state.exactBase) {
    for (const id of referencedNodes(op)) {
      if (!state.created.has(id)) {
        state.base.add(id)
      }
    }
  }
  const contribution: Contribution = { op: resolved, scope }
  if (isRemoval(op)) {
    return remove(state, opProperties(op), contribution)
  }
  if (op.op === "insert" || op.op === "wrap") {
    if (collides(state, op, scope)) {
      return "id-collision"
    }
    const absent = containerReason(state, op)
    if (absent) {
      return absent
    }
    const id = op.op === "insert" ? op.node.id : op.id
    // A node created again starts over where it is created: nothing that
    // placed an earlier one holds.
    const placements = state.placements.get(id)
    if (placements && !liveNode(state, id)) {
      placements.candidates.length = 0
      placements.origin = identityOf(op.target)
    }
    // A new node, or a wrap with a new item set, is a new container: nothing
    // placed in an earlier one holds in it. Another scope's insert at the
    // same target is the same node, so it keeps its version.
    if (!liveNode(state, id) || op.op === "wrap") {
      state.versions.set(id, (state.versions.get(id) ?? 0) + 1)
    }
    state.created.add(id)
    state.createdIn.set(id, identityOf(op.target))
  }
  const absent = op.op === "move" ? containerReason(state, op) : undefined
  if (absent) {
    return absent
  }
  for (const { address, property, breakpoint } of opProperties(op)) {
    if (property === "placement") {
      place(state, op, address, resolved)
    } else {
      write(state, address, property, breakpoint, contribution)
    }
  }
  return undefined
}

function settle({ winner, breakpoints, history }: Entry): ResolvedProperty {
  const live = new Set(breakpoints?.values() ?? [winner.op])
  return {
    winner: winner.op,
    ...(breakpoints && {
      breakpoints: new Map(
        breakpointSchema.options.flatMap((breakpoint) => {
          const op = breakpoints.get(breakpoint)
          return op ? [[breakpoint, op] as const] : []
        })
      ),
    }),
    overridden: history.filter((op) => !live.has(op)),
  }
}

function settlePlacement(
  state: Resolution,
  address: string,
  placements: Placements,
  memo: Map<string, string>
): ResolvedItemPlacement {
  const current = currentPlacement(state, placements)
  if (!current) {
    return {
      container: baseContainer(state, address, memo) ?? placements.origin,
      overridden: placements.history,
    }
  }
  return {
    ...current.placement,
    ...(current.followsBase && {
      container: baseContainer(state, address, memo) ?? placements.origin,
    }),
    winner: current.op,
    overridden: placements.history.filter((op) => op !== current.op),
  }
}

export function settleResolution(state: Resolution): {
  properties: Map<string, Map<OpPropertyKey, ResolvedProperty>>
  placements: Map<string, ResolvedItemPlacement>
} {
  const properties = new Map<string, Map<OpPropertyKey, ResolvedProperty>>()
  for (const [address, node] of state.nodes) {
    const settled = new Map<OpPropertyKey, ResolvedProperty>()
    for (const [property, entry] of node) {
      settled.set(property, settle(entry))
    }
    properties.set(address, settled)
  }
  const memo = new Map<string, string>()
  const placements = new Map<string, ResolvedItemPlacement>()
  for (const [address, item] of state.placements) {
    placements.set(address, settlePlacement(state, address, item, memo))
  }
  // A node an op created in a node that is now gone has moved, even though
  // no placement op touched it.
  for (const [id, parent] of state.createdIn) {
    const container = baseContainer(state, id, memo)
    if (
      !placements.has(id) &&
      liveNode(state, id) &&
      isRemoved(state, parent) &&
      container !== undefined
    ) {
      placements.set(id, { container, overridden: [] })
    }
  }
  return { properties, placements }
}
