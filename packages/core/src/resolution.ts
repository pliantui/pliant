import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import { identityOf } from "./node-identity"
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
  readonly placement?: ResolvedPlacement | undefined
  // The winner this one replaced, which an item a wrap drops returns to.
  readonly previous?: Contribution | undefined
}

interface Entry {
  winner: Contribution
  history: ResolvedOp[]
  scope: string
  // The winner before `scope` first wrote, which a removal falls back to.
  baseline: Contribution | undefined
  breakpoints?: Map<Breakpoint, ResolvedOp>
}

/** The state of a resolution, which ops apply to one at a time in order. */
export interface Resolution {
  readonly nodes: Map<string, Map<OpPropertyKey, Entry>>
  // Ids an insert or wrap has created so far.
  readonly created: Set<string>
  // The base node ids: exactly the ones given, or else the ids an op pointed
  // at before anything created them.
  readonly base: Set<string>
  readonly exactBase: boolean
  // Container identity to the items whose current placement is in it.
  readonly members: Map<string, Set<string>>
}

export function checkBaseIds(baseIds: unknown): void {
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
    created: new Set(),
    base: new Set<string>(baseIds),
    exactBase: baseIds !== undefined,
    members: new Map(),
  }
}

function track(
  state: Resolution,
  item: string,
  from: Contribution | undefined,
  to: Contribution
): void {
  const before = from?.placement?.container
  const after = to.placement?.container
  if (before === after) {
    return
  }
  if (before !== undefined) {
    state.members.get(before)?.delete(item)
  }
  if (after !== undefined) {
    const items = state.members.get(after) ?? new Set<string>()
    items.add(item)
    state.members.set(after, items)
  }
}

function isRemoval(op: Op): boolean {
  return op.op === "remove" || op.op === "removeUserItem"
}

function entryAt(state: Resolution, address: string, property: OpPropertyKey) {
  return state.nodes.get(address)?.get(property)
}

function write(
  state: Resolution,
  { address, property, breakpoint }: OpProperty,
  contribution: Contribution
): void {
  let node = state.nodes.get(address)
  if (!node) {
    node = new Map()
    state.nodes.set(address, node)
  }
  const { op, scope } = contribution
  const entry = node.get(property)
  if (property === "placement") {
    track(state, address, entry?.winner, contribution)
  }
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
  entry.winner = { ...contribution, previous: entry.winner }
}

// A node that was removed, or a version of a wrap that was replaced, no
// longer holds anything.
function isDeadNode(state: Resolution, id: string): boolean {
  return entryAt(state, id, "inserted") !== undefined && !liveNode(state, id)
}

function placesNothing(state: Resolution, { op, placement }: Contribution) {
  const wrap = op.check.op
  return (
    (wrap.op === "wrap" && liveNode(state, wrap.id)?.op !== op) ||
    (placement !== undefined && isDeadNode(state, placement.container))
  )
}

/**
 * Sends every item in the node `id` back to the placement it had just before
 * it entered that node, passing over every placement in that node and every
 * placement that no longer places anything. An item with no such placement
 * goes to `target`, the node's own container, with no position. Items the
 * replacing wrap `cause` placed stay.
 */
function release(
  state: Resolution,
  id: string,
  target: string,
  cause: Contribution
): void {
  for (const item of [...(state.members.get(id) ?? [])]) {
    const entry = entryAt(state, item, "placement")
    if (!entry || entry.winner.op === cause.op) {
      continue
    }
    let previous = entry.winner.previous
    while (
      previous &&
      (previous.placement?.container === id || placesNothing(state, previous))
    ) {
      previous = previous.previous
    }
    const winner = previous ?? {
      ...cause,
      placement: { container: identityOf(target) },
    }
    entry.history.push(cause.op)
    track(state, item, entry.winner, winner)
    entry.winner = winner
  }
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
    const removed = entry.winner.op.check.op
    entry.history.push(removal.op)
    entry.winner = entry.baseline ?? removal
    if (property === "inserted" && !liveNode(state, address)) {
      release(state, address, removed.target, removal)
    }
    applied = true
  }
  return foreign
    ? "cross-layer-remove"
    : applied
      ? undefined
      : "nothing-to-remove"
}

function liveNode(state: Resolution, id: string): Contribution | undefined {
  const winner = entryAt(state, id, "inserted")?.winner
  return winner && !isRemoval(winner.op.check.op) ? winner : undefined
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
  if ((op.op === "insert" || op.op === "wrap") && collides(state, op, scope)) {
    return "id-collision"
  }
  const replaces =
    op.op === "wrap" && liveNode(state, op.id)?.op.check.op.op === "wrap"
  for (const property of opProperties(op)) {
    const { address } = property
    write(
      state,
      property,
      property.property === "placement"
        ? {
            ...contribution,
            placement: placementOf(
              op,
              address,
              entryAt(state, address, "placement")?.winner.placement
            ),
          }
        : contribution
    )
  }
  if (op.op === "insert") {
    state.created.add(op.node.id)
  } else if (op.op === "wrap") {
    state.created.add(op.id)
    if (replaces) {
      release(state, op.id, op.target, contribution)
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
    ...(winner.placement && { placement: winner.placement }),
    overridden: history.filter((op) => !live.has(op)),
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
    properties.set(address, settled)
  }
  return properties
}
