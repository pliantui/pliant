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
  ResolvedOp,
  ResolvedProperty,
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
  // The container's version when the op placed the item, or undefined when
  // the container didn't exist.
  readonly version: number | undefined
}

interface Placements {
  readonly history: ResolvedOp[]
  // Placements that may still hold, latest last. A placement whose container
  // has moved on to another version never holds again, so it is dropped.
  readonly candidates: Placed[]
  // The item's container before any op placed it.
  readonly origin: string
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
  // Created node id to its version, which changes each time the node is
  // created again or its wrap is replaced.
  readonly versions: Map<string, number>
}

function checkBaseIds(baseIds: unknown): void {
  if (
    baseIds !== undefined &&
    !Array.isArray(baseIds) &&
    !(baseIds instanceof Set)
  ) {
    throw new TypeError("baseIds must be an array or a Set of node ids")
  }
}

export function createResolution(
  baseIds?: ReadonlySet<string> | readonly string[]
): Resolution {
  checkBaseIds(baseIds)
  return {
    nodes: new Map(),
    placements: new Map(),
    created: new Set(),
    base: new Set<string>(baseIds),
    exactBase: baseIds !== undefined,
    versions: new Map(),
  }
}

function isRemoval(op: Op): boolean {
  return op.op === "remove" || op.op === "removeUserItem"
}

function entryAt(state: Resolution, address: string, property: OpPropertyKey) {
  return state.nodes.get(address)?.get(property)
}

function nodeAt(state: Resolution, address: string) {
  let node = state.nodes.get(address)
  if (!node) {
    node = new Map()
    state.nodes.set(address, node)
  }
  return node
}

function liveNode(state: Resolution, id: string): Contribution | undefined {
  const winner = entryAt(state, id, "inserted")?.winner
  return winner && !isRemoval(winner.op.check.op) ? winner : undefined
}

/**
 * The version of the node `id` as a container, or undefined while it doesn't
 * exist: a node an op created is live until it is removed, and a base node
 * is always version 0.
 */
function versionOf(state: Resolution, id: string): number | undefined {
  if (entryAt(state, id, "inserted")) {
    return liveNode(state, id) ? state.versions.get(id) : undefined
  }
  // A container that is neither created nor a known base node doesn't exist,
  // so nothing placed in it holds (pending the owner's ruling).
  return state.base.has(id) ? 0 : undefined
}

function holds(state: Resolution, { placement, version }: Placed): boolean {
  return (
    version !== undefined && versionOf(state, placement.container) === version
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
  while (top && !holds(state, top)) {
    candidates.pop()
    top = candidates.at(-1)
  }
  return top
}

/** Where an item created by an op sits before anything moves it. */
function createdIn(state: Resolution, id: string): string | undefined {
  const op = entryAt(state, id, "inserted")?.winner.op.check.op
  return op?.op === "insert" || op?.op === "wrap"
    ? identityOf(op.target)
    : undefined
}

function place(
  state: Resolution,
  op: Op,
  address: string,
  resolved: ResolvedOp
): void {
  nodeAt(state, address)
  let placements = state.placements.get(address)
  if (!placements) {
    placements = {
      history: [],
      candidates: [],
      origin:
        createdIn(state, address) ??
        (op.op === "wrap" ? identityOf(op.target) : parentOf(op.target)),
    }
    state.placements.set(address, placements)
  }
  const container =
    currentPlacement(state, placements)?.placement.container ??
    createdIn(state, address) ??
    placements.origin
  const placement = placementOf(op, address, container)
  if (placement) {
    placements.history.push(resolved)
    placements.candidates.push({
      op: resolved,
      placement,
      version: versionOf(state, placement.container),
    })
  }
}

function write(
  state: Resolution,
  { address, property, breakpoint }: OpProperty,
  contribution: Contribution
): void {
  const node = nodeAt(state, address)
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
    const entry = entryAt(state, address, property)
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
    const id = op.op === "insert" ? op.node.id : op.id
    // A new node, or a wrap with a new item set, is a new container: nothing
    // placed in an earlier one holds in it. Another scope's insert at the
    // same target is the same node, so it keeps its version.
    if (!liveNode(state, id) || op.op === "wrap") {
      state.versions.set(id, (state.versions.get(id) ?? 0) + 1)
    }
    state.created.add(id)
  }
  for (const property of opProperties(op)) {
    if (property.property === "placement") {
      place(state, op, property.address, resolved)
    } else {
      write(state, property, contribution)
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

/**
 * The item's placement: the latest one whose container still exists in the
 * version it had when the item was placed, else its base parent with no
 * position and no winner.
 */
function settlePlacement(
  state: Resolution,
  address: string,
  placements: Placements
): ResolvedProperty {
  const current = currentPlacement(state, placements)
  return current
    ? {
        winner: current.op,
        placement: current.placement,
        overridden: placements.history.filter((op) => op !== current.op),
      }
    : {
        placement: {
          container: createdIn(state, address) ?? placements.origin,
        },
        overridden: placements.history,
      }
}

export function settleResolution(
  state: Resolution
): Map<string, Map<OpPropertyKey, ResolvedProperty>> {
  const properties = new Map<string, Map<OpPropertyKey, ResolvedProperty>>()
  for (const [address, node] of state.nodes) {
    const settled = new Map<OpPropertyKey, ResolvedProperty>()
    for (const [property, entry] of node) {
      settled.set(property, settle(entry))
    }
    const placements = state.placements.get(address)
    if (placements) {
      settled.set("placement", settlePlacement(state, address, placements))
    }
    properties.set(address, settled)
  }
  return properties
}
