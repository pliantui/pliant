import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import type { OpCheck } from "./check-op"
import type { LoadedOverlay } from "./load-overlay"
import {
  opProperties,
  type OpProperty,
  type OpPropertyKey,
} from "./op-property"
import { orderOverlays } from "./order-overlays"

export interface ResolvedOp {
  readonly check: Extract<OpCheck, { status: "valid" }>
  readonly overlay: LoadedOverlay
}

export interface ResolvedProperty {
  /** The last op applied to the property. */
  readonly winner: ResolvedOp
  /**
   * Set for `layout` and `span` only: the winning layer's op at each
   * breakpoint it sets, in breakpoint order. A layer that sets any breakpoint
   * replaces every breakpoint of the layers below it.
   */
  readonly breakpoints?: ReadonlyMap<Breakpoint, ResolvedOp>
  /** The ops the winner replaced, lowest precedence first. */
  readonly overridden: readonly ResolvedOp[]
}

export interface SkippedOp {
  readonly check: Exclude<OpCheck, { status: "valid" }>
  readonly overlay: LoadedOverlay
}

/**
 * Why a valid op didn't apply. `remove` and `removeUserItem` only clear what
 * the same layer added: `cross-layer-remove` means only a lower layer added
 * it, and `nothing-to-remove` means nothing was there.
 */
export type UnappliedReason = "cross-layer-remove" | "nothing-to-remove"

export interface UnappliedOp extends ResolvedOp {
  readonly reason: UnappliedReason
}

export interface ResolveLayersOptions {
  /**
   * Team ids, highest precedence first. Overlays from teams not listed rank
   * below the listed ones.
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
  breakpoints?: Map<Breakpoint, ResolvedOp>
  overridden: ResolvedOp[]
}

type Nodes = Map<string, Map<OpPropertyKey, Entry>>

function isRemoval(op: Op): boolean {
  return op.op === "remove" || op.op === "removeUserItem"
}

function write(
  nodes: Nodes,
  { address, property, breakpoint }: OpProperty,
  resolved: ResolvedOp
): void {
  let node = nodes.get(address)
  if (!node) {
    node = new Map()
    nodes.set(address, node)
  }
  const entry = node.get(property)
  if (!entry) {
    node.set(property, {
      winner: resolved,
      overridden: [],
      ...(breakpoint && { breakpoints: new Map([[breakpoint, resolved]]) }),
    })
    return
  }
  if (entry.breakpoints && breakpoint) {
    if (entry.winner.overlay.layer !== resolved.overlay.layer) {
      entry.breakpoints.clear()
    }
    entry.breakpoints.set(breakpoint, resolved)
  }
  entry.overridden.push(entry.winner)
  entry.winner = resolved
}

function remove(
  nodes: Nodes,
  properties: readonly OpProperty[],
  resolved: ResolvedOp
): UnappliedReason | undefined {
  let found = false
  let applied = false
  for (const { address, property } of properties) {
    const entry = nodes.get(address)?.get(property)
    if (!entry || isRemoval(entry.winner.check.op)) {
      continue
    }
    found = true
    if (entry.winner.overlay.layer === resolved.overlay.layer) {
      entry.overridden.push(entry.winner)
      entry.winner = resolved
      applied = true
    }
  }
  if (applied) {
    return undefined
  }
  return found ? "cross-layer-remove" : "nothing-to-remove"
}

function settleBreakpoints(entry: Entry): void {
  const { breakpoints } = entry
  if (!breakpoints) {
    return
  }
  const live = new Set(breakpoints.values())
  entry.overridden = entry.overridden.filter((op) => !live.has(op))
  entry.breakpoints = new Map(
    breakpointSchema.options.flatMap((breakpoint) => {
      const op = breakpoints.get(breakpoint)
      return op ? [[breakpoint, op] as const] : []
    })
  )
}

/**
 * Resolves the overlays for one surface, plus the @app overlays, into a value
 * per (address, property). Layers apply org, team, personal, session; within
 * a layer, overlays apply in a fixed order (see `teamOrder`), and within an
 * overlay later ops win. Only valid ops apply: `skipped` lists the others and
 * `unapplied` lists valid removals that had nothing of their layer to remove,
 * both in the order they were met.
 */
export function resolveLayers(
  overlays: readonly LoadedOverlay[],
  { teamOrder = [] }: ResolveLayersOptions = {}
): ResolvedLayers {
  const nodes: Nodes = new Map()
  const skipped: SkippedOp[] = []
  const unapplied: UnappliedOp[] = []
  for (const overlay of orderOverlays(overlays, teamOrder)) {
    for (const check of overlay.ops) {
      if (check.status !== "valid") {
        skipped.push({ check, overlay })
        continue
      }
      const resolved = { check, overlay }
      const properties = opProperties(check.op)
      if (!isRemoval(check.op)) {
        for (const property of properties) {
          write(nodes, property, resolved)
        }
        continue
      }
      const reason = remove(nodes, properties, resolved)
      if (reason) {
        unapplied.push({ check, overlay, reason })
      }
    }
  }
  for (const node of nodes.values()) {
    for (const entry of node.values()) {
      settleBreakpoints(entry)
    }
  }
  return { properties: nodes, skipped, unapplied }
}
