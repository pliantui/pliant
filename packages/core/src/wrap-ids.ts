import type { Op } from "@pliantui/contract"

import { createdNodeId, referencedNodes } from "./node-ids"
import { scopeKeyOf } from "./overlay-scope"
import type { ResolvedLayers } from "./resolve-layers"

export type WrapOp = Extract<Op, { op: "wrap" }>

export interface WrapOwner {
  readonly scope: string
  readonly target: string
}

export interface NodeIds {
  /**
   * Ids of nodes the ops point at that must be base nodes: an id in a slot
   * that no insert creates, or an id at the start of an address that no
   * insert or wrap creates.
   */
  readonly base: ReadonlySet<string>
  wrap(id: string): WrapOwner | undefined
  isInserted(id: string): boolean
}

/**
 * A wrap id must be new to the surface. It may only replace a wrap with the
 * same id, scope and target.
 */
export function wrapCollides(op: WrapOp, scope: string, ids: NodeIds): boolean {
  if (
    ids.base.has(op.id) ||
    ids.isInserted(op.id) ||
    referencedNodes(op).some(({ id }) => id === op.id)
  ) {
    return true
  }
  const owner = ids.wrap(op.id)
  return (
    owner !== undefined && (owner.scope !== scope || owner.target !== op.target)
  )
}

export function baseNodeIds(ops: Iterable<Op>): Set<string> {
  const slots = new Set<string>()
  const roots = new Set<string>()
  const inserted = new Set<string>()
  const wrapped = new Set<string>()
  for (const op of ops) {
    for (const { id, slot } of referencedNodes(op)) {
      const ids = slot ? slots : roots
      ids.add(id)
    }
    const id = createdNodeId(op)
    if (id !== undefined) {
      const ids = op.op === "insert" ? inserted : wrapped
      ids.add(id)
    }
  }
  const base = new Set<string>()
  for (const id of slots) {
    if (!inserted.has(id)) {
      base.add(id)
    }
  }
  for (const id of roots) {
    if (!inserted.has(id) && !wrapped.has(id)) {
      base.add(id)
    }
  }
  return base
}

/**
 * The node ids in resolved layers, plus those the given ops point at, for
 * checking a new overlay's wrap ids.
 */
export function nodeIdsOf(
  { properties }: ResolvedLayers,
  ops: readonly Op[]
): NodeIds {
  const wraps = new Map<string, WrapOwner>()
  const inserted = new Set<string>()
  const applied = new Set<Op>(ops)
  for (const node of properties.values()) {
    for (const { winner, overridden, breakpoints } of node.values()) {
      for (const { check } of [
        winner,
        ...overridden,
        ...(breakpoints?.values() ?? []),
      ]) {
        applied.add(check.op)
      }
    }
    const op = node.get("inserted")?.winner
    if (op?.check.op.op === "wrap") {
      wraps.set(op.check.op.id, {
        scope: scopeKeyOf(op.overlay),
        target: op.check.op.target,
      })
    } else if (op?.check.op.op === "insert") {
      inserted.add(op.check.op.node.id)
    }
  }
  return {
    base: baseNodeIds(applied),
    wrap: (id) => wraps.get(id),
    isInserted: (id) => inserted.has(id),
  }
}
