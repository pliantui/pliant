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
  // Ids an op pointed at before anything created them, so base nodes.
  readonly base: Set<string>
}

type WrapOp = Extract<Op, { op: "wrap" }>

export function createResolution(): Resolution {
  return { nodes: new Map(), created: new Set(), base: new Set() }
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

/**
 * Sends the items `wrap` still places back to their placement from before the
 * wrap's scope wrote it. Items a replacing wrap lists already have it as their
 * winner, so they stay.
 */
function release(
  state: Resolution,
  wrap: ResolvedOp,
  cause: Contribution
): void {
  const { op } = wrap.check
  if (op.op !== "wrap") {
    return
  }
  for (const item of op.items) {
    const entry = entryAt(state, item, "placement")
    if (entry?.winner.op !== wrap) {
      continue
    }
    entry.history.push(cause.op)
    entry.winner = entry.baseline ?? {
      ...cause,
      placement: { container: identityOf(op.target) },
    }
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
    const removed = entry.winner.op
    entry.history.push(removal.op)
    entry.winner = entry.baseline ?? removal
    if (property === "inserted") {
      release(state, removed, removal)
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

function replacedWrap(state: Resolution, op: WrapOp): ResolvedOp | undefined {
  const live = liveNode(state, op.id)
  return live?.op.check.op.op === "wrap" ? live.op : undefined
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
  for (const id of referencedNodes(op)) {
    if (!state.created.has(id)) {
      state.base.add(id)
    }
  }
  const contribution: Contribution = { op: resolved, scope }
  if (isRemoval(op)) {
    return remove(state, opProperties(op), contribution)
  }
  if ((op.op === "insert" || op.op === "wrap") && collides(state, op, scope)) {
    return "id-collision"
  }
  const replaced = op.op === "wrap" ? replacedWrap(state, op) : undefined
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
    if (replaced) {
      release(state, replaced, contribution)
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
