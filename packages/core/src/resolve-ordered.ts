import { compareOrdered } from "./compare-ordered"
import type { Guardrail } from "./guardrail"
import { addressParents } from "./node-identity"
import { scopeKeyOf } from "./overlay-scope"
import type { ReadFlags } from "./read-flags"
import { applyOp, createResolution, settleResolution } from "./resolution"
import type {
  ResolvedOp,
  ResolveLayersOptions,
  SkippedOp,
  UnappliedOp,
} from "./resolve-layers"
import { staysVisible } from "./stays-visible"
import type { OrderedOverlay } from "./surface-order"

const guardrails: readonly Guardrail[] = [staysVisible]

// Only these ops write `visible`, `inserted`, `collapse.*` or a placement,
// so only they can hide a node that was visible.
const canHide = new Set([
  "hide",
  "collapse",
  "move",
  "pin",
  "promote",
  "demote",
  "insert",
  "wrap",
  "remove",
])

type Step =
  | { readonly skipped: SkippedOp }
  | { readonly op: ResolvedOp; readonly scope: string }

/**
 * Each node's parent in the base: `baseParents` when given, else what the
 * flags' addresses show, then what the ops' addresses show, the first one
 * wins. An item's parent always comes from its address.
 */
function baseParentsOf(
  ops: readonly ResolvedOp[],
  flags: ReadFlags,
  baseParents: ReadonlyMap<string, string | null> | undefined
): Map<string, string> {
  const parents = new Map(baseParents ? [] : flags.parents)
  for (const [id, parent] of baseParents ?? []) {
    if (parent !== null) {
      parents.set(id, parent)
    }
  }
  for (const id of flags.flags.keys()) {
    addressParents(id).forEach(([item, node]) => parents.set(item, node))
  }
  for (const { check } of ops) {
    const { op } = check
    const addresses = [
      op.target,
      ...(op.op === "move" && "into" in op.to ? [op.to.into] : []),
    ]
    for (const [id, parent] of addresses.flatMap(addressParents)) {
      // An item's parent is part of its identity, so no input overrides it.
      if (!parents.has(id) && (!baseParents || id.includes("/"))) {
        parents.set(id, parent)
      }
    }
  }
  return parents
}

/**
 * Applies the ordered overlays' valid ops one at a time, in resolution
 * order. With flags, after each op that can hide something, it checks the
 * guardrails on the state so far, and skips the op if it breaks one: every
 * op before it was kept, so the op that completes a violation is the one
 * from the highest layer involved. An op is judged against the ops before
 * it only, so a lower op is skipped even when a higher op would have undone
 * what it did.
 *
 * Each op that can hide something settles the state once, and each skipped
 * op applies the ops kept before it again, so time grows with the number of
 * those ops times the number of ops. Ops that can't hide anything, such as
 * sorts and widths, add no checks.
 */
export function resolveOrdered(
  ordered: readonly OrderedOverlay[],
  baseIds: ResolveLayersOptions["baseIds"],
  flags: ReadFlags | undefined,
  baseParents?: ReadonlyMap<string, string | null>
) {
  const steps: Step[] = []
  for (const { overlay, reason } of ordered) {
    const scope = scopeKeyOf(overlay)
    for (const check of overlay.ops) {
      if (reason) {
        steps.push({ skipped: { check, overlay, reason } })
      } else if (check.status === "unknown") {
        steps.push({
          skipped: {
            check,
            overlay,
            reason: check.extension ? "extension-not-installed" : "unknown",
          },
        })
      } else if (check.status === "newer") {
        steps.push({ skipped: { check, overlay, reason: "newer" } })
      } else if (check.status === "invalid") {
        steps.push({ skipped: { check, overlay, reason: "invalid" } })
      } else {
        steps.push({ op: { check, overlay }, scope })
      }
    }
  }
  const parents =
    flags &&
    baseParentsOf(
      steps.flatMap((step) => ("op" in step ? [step.op] : [])),
      flags,
      baseParents
    )
  const kept: { op: ResolvedOp; scope: string }[] = []
  const skipped: SkippedOp[] = []
  const unapplied = new Map<ResolvedOp, UnappliedOp>()
  let state = createResolution(baseIds)
  for (const step of steps) {
    if ("skipped" in step) {
      skipped.push(step.skipped)
      continue
    }
    const { op, scope } = step
    const notApplied = applyOp(state, op, scope)
    if (notApplied) {
      unapplied.set(op, { ...op, reason: notApplied })
    }
    const [violation] =
      flags && parents && canHide.has(op.check.op.op)
        ? guardrails
            .flatMap((guardrail) =>
              guardrail({
                ...settleResolution(state),
                flags: flags.flags,
                parents,
              })
            )
            .sort((a, b) => compareOrdered(a.node, b.node))
        : []
    if (!violation) {
      kept.push(step)
      continue
    }
    const { guardrail, flag, node, ops } = violation
    skipped.push({
      ...op,
      reason: "guardrail",
      guardrail,
      flag,
      node,
      conflictsWith: ops.filter((other) => other !== op),
    })
    unapplied.delete(op)
    // The resolution can't take an op back, so it starts over without it.
    state = createResolution(baseIds)
    for (const { op: keptOp, scope: keptScope } of kept) {
      applyOp(state, keptOp, keptScope)
    }
  }
  return {
    ...settleResolution(state),
    skipped,
    unapplied: [...unapplied.values()],
  }
}
