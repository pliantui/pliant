import { flagsSchema, type Flags } from "@pliantui/contract"

import type { Guardrail, Violation } from "./guardrail"
import type { LoadedOverlay } from "./load-overlay"
import { identityOf } from "./node-identity"
import { scopeKeyOf } from "./overlay-scope"
import { applyOp, createResolution, settleResolution } from "./resolution"
import type {
  BaseIds,
  ResolvedOp,
  SkippedOp,
  UnappliedOp,
} from "./resolve-layers"
import { staysVisible } from "./stays-visible"
import type { OrderedOverlay } from "./surface-order"
import type { ValidateOverlayLayers } from "./validate-overlay"

const guardrails: readonly Guardrail[] = [
  staysVisible("critical"),
  staysVisible("required"),
]

/** Records each node's parent as its address shows it, the first one wins. */
function addParents(parents: Map<string, string>, address: string): void {
  let rest = address
  for (;;) {
    const parent = rest.replace(/\/[^/]+\/[^/]+$/, "")
    if (parent === rest) {
      return
    }
    const id = identityOf(rest)
    if (!parents.has(id)) {
      parents.set(id, identityOf(parent))
    }
    rest = parent
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Flags by identity, and each node's parent as the flags' addresses show. */
export interface ReadFlags {
  readonly flags: ReadonlyMap<string, Flags>
  readonly parents: ReadonlyMap<string, string>
}

/**
 * Checks `flags` and reads them by identity. Addresses of the same node
 * combine their flags. Returns undefined when no node is flagged, so
 * resolution can skip the guardrails. `name` names the option in errors.
 */
export function readFlags(
  flags: unknown,
  name = "flags"
): ReadFlags | undefined {
  if (flags === undefined) {
    return undefined
  }
  if (!isRecord(flags)) {
    throw new TypeError(`${name} must map addresses to flags`)
  }
  const read = new Map<string, Flags>()
  const parents = new Map<string, string>()
  for (const [address, value] of Object.entries(flags)) {
    const parsed = flagsSchema.safeParse(value)
    if (!parsed.success) {
      throw new TypeError(`${name}["${address}"] must be valid flags`)
    }
    const id = identityOf(address)
    const merged: Flags = { ...read.get(id) }
    for (const flag of flagsSchema.keyof().options) {
      if (parsed.data[flag] === true) {
        merged[flag] = true
      }
    }
    read.set(id, merged)
    addParents(parents, address)
  }
  return read.size > 0 ? { flags: read, parents } : undefined
}

/**
 * Applies the ordered overlays' valid ops, then checks the guardrails on the
 * result. Each violation skips the op among those involved that applied
 * last, which is the op from the highest layer, and everything resolves
 * again without it. Each extra pass skips at least one more op, so there
 * are at most as many passes as ops, plus one.
 */
export function resolveOrdered(
  ordered: readonly OrderedOverlay[],
  baseIds: BaseIds | ValidateOverlayLayers["baseIds"],
  flags: ReadFlags | undefined
) {
  // Ops apply by overlay, then index, so this ranks them in that order.
  const ranks = new Map<LoadedOverlay, number>()
  let next = 0
  for (const { overlay } of ordered) {
    if (!ranks.has(overlay)) {
      ranks.set(overlay, next)
      next += overlay.ops.length
    }
  }
  const rank = ({ overlay, check }: ResolvedOp) =>
    (ranks.get(overlay) ?? 0) + check.index
  const parents = new Map(flags?.parents)
  if (flags) {
    for (const { overlay, reason } of ordered) {
      for (const check of reason ? [] : overlay.ops) {
        if (check.status === "valid") {
          addParents(parents, check.op.target)
          if (check.op.op === "move" && "into" in check.op.to) {
            addParents(parents, check.op.to.into)
          }
        }
      }
    }
  }
  const blocked = new Map<number, Violation>()
  for (;;) {
    const state = createResolution(baseIds)
    const skipped: SkippedOp[] = []
    const unapplied: UnappliedOp[] = []
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
          const violation = blocked.get(rank({ check, overlay }))
          if (violation) {
            const { guardrail, node } = violation
            skipped.push({
              check,
              overlay,
              reason: "guardrail",
              guardrail,
              node,
            })
            continue
          }
          const notApplied = applyOp(state, { check, overlay }, scope)
          if (notApplied) {
            unapplied.push({ check, overlay, reason: notApplied })
          }
        }
      }
    }
    const settled = settleResolution(state)
    const violations = flags
      ? guardrails.flatMap((guardrail) =>
          guardrail({ ...settled, flags: flags.flags, parents })
        )
      : []
    const count = blocked.size
    for (const violation of violations) {
      const last = Math.max(...violation.ops.map(rank))
      if (!blocked.has(last)) {
        blocked.set(last, violation)
      }
    }
    if (blocked.size === count) {
      return { ...settled, skipped, unapplied }
    }
  }
}
