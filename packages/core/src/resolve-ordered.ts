import type { Manifest } from "@pliantui/contract"

import { compareOrdered } from "./compare-ordered"
import type { FieldSchema } from "./field-schema"
import { freeShortcut } from "./free-shortcut"
import type { Guardrail, Violation } from "./guardrail"
import { keepsMeaning } from "./keeps-meaning"
import { addressParents } from "./node-identity"
import { scopeKeyOf } from "./overlay-scope"
import type { ReadFlags } from "./read-flags"
import {
  applyOp,
  createResolution,
  readBaseIds,
  settleResolution,
} from "./resolution"
import type {
  ResolvedOp,
  ResolveLayersOptions,
  SkippedOp,
  UnappliedOp,
} from "./resolve-layers"
import { staysClear } from "./stays-clear"
import { staysInPlace } from "./stays-in-place"
import { staysVisible } from "./stays-visible"
import type { OrderedOverlay } from "./surface-order"
import { validDefault } from "./valid-default"

const guardrails: readonly Guardrail[] = [staysVisible, staysClear]

// The ops that can take a node out of sight or move one, plus insert as a
// safety margin.
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

/** What the rules on single ops read besides the resolved state. */
export interface OpRules {
  readonly manifests: ReadonlyMap<string, Manifest>
  readonly reservedShortcuts: readonly string[]
  readonly fields: ReadonlyMap<string, FieldSchema>
}

const noRules: OpRules = {
  manifests: new Map(),
  reservedShortcuts: [],
  fields: new Map(),
}

const isField = (id: string) => id.includes("/fields/")

/** The form fields the caller names, by identity. */
function fieldsOf(
  rules: OpRules,
  flags: ReadFlags | undefined,
  baseOrder: ReadonlyMap<string, readonly string[]> | undefined
) {
  return new Set([
    ...rules.fields.keys(),
    ...[...(flags?.flags.keys() ?? [])].filter(isField),
    ...[...(baseOrder ?? [])].flatMap(([group, items]) =>
      group.endsWith("/fields") ? items.map((item) => `${group}/${item}`) : []
    ),
  ])
}

type Step =
  | { readonly skipped: SkippedOp }
  | { readonly op: ResolvedOp; readonly scope: string }

/**
 * Each node's parent in the base. `known` comes from the caller alone:
 * `baseParents` when given, else what the flags' addresses show, then the
 * nodes `baseOrder` lists, the first one wins. `parents` adds, without
 * `baseParents`, what the ops' addresses show. An item's parent always
 * comes from its address.
 */
function baseParentsOf(
  ops: readonly ResolvedOp[],
  flags: ReadFlags,
  baseParents: ReadonlyMap<string, string | null> | undefined,
  baseOrder: ReadonlyMap<string, readonly string[]> | undefined
) {
  const known = new Map(baseParents ? [] : flags.parents)
  for (const [id, parent] of baseParents ?? []) {
    if (parent !== null) {
      known.set(id, parent)
    }
  }
  for (const id of flags.flags.keys()) {
    addressParents(id).forEach(([item, node]) => known.set(item, node))
  }
  for (const [parent, children] of baseOrder ?? []) {
    for (const child of parent.includes("/") ? [] : children) {
      if (!known.has(child)) {
        known.set(child, parent)
      }
    }
  }
  const parents = new Map(known)
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
  return { known, parents }
}

/**
 * Applies the ordered overlays' valid ops one at a time, in resolution
 * order. With flags, after each op that can hide or move something, it
 * checks the guardrails on the state so far; after each `bindShortcut`,
 * `setProp`, `setDefault` and `wrap`, it checks the rules on shortcuts,
 * variants and form fields. It skips the op
 * if it breaks one: every op before it was kept, so the op that completes a
 * violation is the one from the highest layer involved. An op is judged
 * against the ops before it only, so a lower op is skipped even when a
 * higher op would have undone what it did.
 *
 * Each op that can hide or move something settles the state once, and each
 * skipped op applies the ops kept before it again, so time grows with the
 * number of those ops times the number of ops, and with the number of flags
 * times the depth of the tree. With a primary action, each op that touches
 * its group also orders the group, which grows with the placement ops so
 * far. Ops that can't hide or move anything, such as sorts and widths, add
 * no checks. For scale, see `flags` in `ResolveLayersOptions`.
 */
export function resolveOrdered(
  ordered: readonly OrderedOverlay[],
  baseIds: ResolveLayersOptions["baseIds"],
  flags: ReadFlags | undefined,
  baseParents?: ReadonlyMap<string, string | null>,
  baseOrder?: ReadonlyMap<string, readonly string[]>,
  rules: OpRules = noRules
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
  const tree =
    flags &&
    baseParentsOf(
      steps.flatMap((step) => ("op" in step ? [step.op] : [])),
      flags,
      baseParents,
      baseOrder
    )
  const overlays = ordered.map(({ overlay }) => overlay)
  const known = readBaseIds(baseIds)
  const fields = fieldsOf(rules, flags, baseOrder)
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
    const name = op.check.op.op
    const shortcut =
      name === "bindShortcut"
        ? freeShortcut(
            op,
            settleResolution(state).properties,
            rules.reservedShortcuts
          )
        : undefined
    const [violation]: (Violation | undefined)[] = [
      shortcut ??
        keepsMeaning(op, rules.manifests, flags?.flags) ??
        validDefault(op, rules.fields) ??
        (notApplied ? undefined : staysInPlace(op, fields)),
      ...(flags && tree && canHide.has(name)
        ? guardrails
            .flatMap((guardrail) =>
              guardrail({
                ...settleResolution(state),
                overlays,
                baseIds: known,
                flags: flags.flags,
                ...tree,
                order: baseOrder ?? new Map(),
                op,
              })
            )
            .sort((a, b) => compareOrdered(a.node, b.node))
        : []),
    ].filter((each) => each !== undefined)
    if (!violation) {
      kept.push(step)
      continue
    }
    const { ops, ...rule } = violation
    skipped.push({
      ...op,
      reason: "guardrail",
      ...rule,
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
