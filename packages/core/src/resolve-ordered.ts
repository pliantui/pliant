import { compareOrdered } from "./compare-ordered"
import type { Guardrail, Violation } from "./guardrail"
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

type Step =
  | { readonly skipped: SkippedOp }
  | { readonly op: ResolvedOp; readonly scope: string }

interface Blocked {
  readonly violation: Violation
  readonly conflictsWith: readonly ResolvedOp[]
}

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
 * Applies the ordered overlays' valid ops, then checks the guardrails on the
 * result. Each violation skips the op among those involved that applied
 * last, which is the op from the highest layer, and everything resolves
 * again without it. When that op decides a property, the ops below it that
 * would break the rule the same way, and still applied after every other op
 * involved, are skipped in the same pass, so a stack of hides on one node
 * takes one pass. Each extra pass skips at least one more op, so there are
 * at most as many passes as valid ops, plus one, each applying every op: in
 * the worst case, time grows with the square of the number of ops.
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
  const sequence = steps.flatMap((step) => ("op" in step ? [step.op] : []))
  const parents = flags && baseParentsOf(sequence, flags, baseParents)
  const blocked = new Map<ResolvedOp, Blocked>()
  for (;;) {
    const state = createResolution(baseIds)
    const skipped: SkippedOp[] = []
    const unapplied: UnappliedOp[] = []
    for (const step of steps) {
      if ("skipped" in step) {
        skipped.push(step.skipped)
        continue
      }
      const { op, scope } = step
      const block = blocked.get(op)
      if (block) {
        const { guardrail, flag, node } = block.violation
        skipped.push({
          ...op,
          reason: "guardrail",
          guardrail,
          flag,
          node,
          conflictsWith: block.conflictsWith,
        })
        continue
      }
      const notApplied = applyOp(state, op, scope)
      if (notApplied) {
        unapplied.push({ ...op, reason: notApplied })
      }
    }
    const settled = settleResolution(state)
    const violations =
      flags && parents
        ? guardrails.flatMap((guardrail) =>
            guardrail({ ...settled, flags: flags.flags, parents })
          )
        : []
    const order = (op: ResolvedOp) => sequence.indexOf(op)
    // Violations whose op to skip applied first go first, so skipping it can
    // settle later ones that share it, and the result never depends on the
    // order of `flags`.
    const queue = violations
      .map((violation) => ({
        violation,
        last: Math.max(...violation.ops.map(order)),
      }))
      .sort(
        (a, b) =>
          a.last - b.last || compareOrdered(a.violation.node, b.violation.node)
      )
    const count = blocked.size
    for (const { violation, last } of queue) {
      const [decides, ...others] = violation.ops
      const culprit = sequence[last]
      // An op skipped earlier in this pass may settle this violation, so the
      // next pass checks it again.
      if (!culprit || violation.ops.some((op) => blocked.has(op))) {
        continue
      }
      blocked.set(culprit, {
        violation,
        conflictsWith: violation.ops.filter((op) => op !== culprit),
      })
      if (culprit === decides) {
        const after = Math.max(-1, ...others.map(order))
        for (const op of violation.next) {
          if (order(op) < after) {
            break
          }
          blocked.set(op, { violation, conflictsWith: others })
        }
      }
    }
    if (blocked.size === count) {
      return { ...settled, skipped, unapplied }
    }
  }
}
