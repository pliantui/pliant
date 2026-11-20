import type { Op } from "@pliantui/contract"

import { groupOf } from "./action-group"
import { compareOrdered } from "./compare-ordered"
import { containerOf } from "./container-of"
import type { Guardrail, GuardrailInput, Violation } from "./guardrail"
import { identityOf, parentOf } from "./node-identity"
import { orderItems } from "./order-items"
import type { ResolvedOp } from "./resolve-layers"
import { resolveRegion, type RegionEntry } from "./resolve-region"

interface Placed {
  readonly id: string
  readonly shown: boolean
  readonly overflow: boolean
}

const last = (id: string) => id.slice(id.lastIndexOf("/") + 1)

const isWrapper = (id: string, input: GuardrailInput) =>
  input.properties.get(id)?.get("inserted")?.winner.check.op.op === "wrap"

/** The op that collapses `id` in `container`, if one does. */
function collapseOf(id: string, container: string, input: GuardrailInput) {
  const winner = input.properties
    .get(container)
    ?.get(`collapse.${last(id)}`)?.winner
  const op = winner?.check.op
  return op?.op === "collapse" && op.into !== "none" ? winner : undefined
}

/**
 * The group that holds `id` once every op has applied: an item's node and
 * collection, or the node that holds a node, past any wrappers, so a
 * wrapped action stays in its group.
 */
function groupNow(id: string, input: GuardrailInput) {
  if (id.includes("/")) {
    return groupOf(id, input.known) ?? undefined
  }
  let group = containerOf(id, input).container
  for (
    const seen = new Set<string>();
    group !== undefined && isWrapper(group, input) && !seen.has(group);
    group = containerOf(group, input).container
  ) {
    seen.add(group)
  }
  return group
}

/**
 * The members of `group` before any op, in order, from what the caller
 * gave alone: those `baseOrder` lists, in its order, and the others that
 * `baseParents`, `baseOrder` or a flag's address put there, by identity.
 * Core can't know where an unlisted action sits, so an unlisted primary
 * action goes first and a destructive one last.
 */
function startOrder(group: string, { flags, known, order }: GuardrailInput) {
  const prefix = group.includes("/") ? `${group}/` : ""
  const listed = (order.get(group) ?? []).map((id) => prefix + id)
  const isListed = new Set(listed)
  const side = (id: string) =>
    flags.get(id)?.primary ? -1 : flags.get(id)?.destructive ? 1 : 0
  const others = [...new Set([...flags.keys(), ...known.keys()])]
    .filter((id) => !isListed.has(id) && groupOf(id, known) === group)
    .sort((a, b) => side(a) - side(b) || compareOrdered(a, b))
  return [
    ...others.filter((id) => side(id) < 0),
    ...listed,
    ...others.filter((id) => side(id) >= 0),
  ]
}

/** The members of `group` in the order they render, wrappers flattened. */
function orderNow(group: string, input: GuardrailInput): Placed[] {
  const start = startOrder(group, input)
  if (!group.includes("/")) {
    const flatten = (
      entries: readonly RegionEntry[],
      shown: boolean,
      overflow: boolean
    ): Placed[] =>
      entries.flatMap((entry) => {
        const placed = {
          id: entry.id,
          shown: shown && entry.visible,
          overflow: overflow || entry.collapsed !== undefined,
        }
        return entry.kind === "wrapper"
          ? flatten(entry.entries, placed.shown, placed.overflow)
          : [placed]
      })
    const layers = { ...input, skipped: [], unapplied: [] }
    return flatten(
      resolveRegion(layers, { id: group, slots: start }).entries,
      true,
      false
    )
  }
  const node = group.slice(0, group.indexOf("/"))
  const prefix = `${group}/`
  return orderItems(
    start.map(last),
    (item) => input.placements.get(prefix + item)?.position
  ).map((item) => {
    const id = prefix + item
    const position = input.placements.get(id)?.position
    return {
      id,
      shown:
        input.properties.get(id)?.get("visible")?.winner.check.op.op !== "hide",
      overflow:
        collapseOf(id, node, input) !== undefined ||
        (position !== undefined &&
          "promoted" in position &&
          !position.promoted),
    }
  })
}

/** 2 when `destructive` is before `primary`, 1 right after it, else 0. */
function closeness(order: string[], destructive: string, primary: string) {
  const gap = order.indexOf(destructive) - order.indexOf(primary)
  return !order.includes(destructive) || !order.includes(primary)
    ? 0
    : gap < 0
      ? 2
      : gap === 1
        ? 1
        : 0
}

/** The ids an op names: its target, the target's parent, and the rest. */
function named(op: Op): string[] {
  const ids = [identityOf(op.target), parentOf(op.target)]
  if (op.op === "move") {
    ids.push(
      "into" in op.to
        ? identityOf(op.to.into)
        : "before" in op.to
          ? op.to.before
          : "after" in op.to
            ? op.to.after
            : ""
    )
  } else if (op.op === "wrap") {
    ids.push(op.id, ...op.items)
  } else if (op.op === "collapse") {
    ids.push(...op.items)
  } else if (op.op === "insert") {
    ids.push(op.node.id)
  }
  return ids
}

/**
 * Whether `op` can change `group`'s order: it names the group, a flagged
 * action, or a node that is, was or was created in the group or in a node
 * inside it.
 */
function touches(op: Op, group: string, input: GuardrailInput) {
  const inGroup = (id: string | undefined) => {
    const seen = new Set<string>()
    for (let node = id; node !== undefined && !seen.has(node);) {
      if (node === group) {
        return true
      }
      seen.add(node)
      node = containerOf(node, input).container
    }
    return false
  }
  const node = group.split("/")[0]
  return named(op).some((id) => {
    const placement = input.placements.get(id)
    const inserted = input.properties.get(id)?.get("inserted")
    const history = [
      ...(placement?.overridden ?? []),
      ...(placement?.winner ? [placement.winner] : []),
      ...(inserted ? [...inserted.overridden, inserted.winner] : []),
    ].map(({ check }) => check.op)
    const places = new Set([
      id,
      input.parents.get(id),
      ...history.map((past) =>
        past.op === "move" && "into" in past.to
          ? identityOf(past.to.into)
          : past.op === "wrap" && past.id !== id
            ? past.id
            : identityOf(past.target)
      ),
    ])
    return id === node || input.flags.has(id) || [...places].some(inGroup)
  })
}

/**
 * The ops that put `id` where it is in `group`: its placement and the op
 * that moved it in or out, a `collapse` or `remove` of it or of a wrapper
 * that holds it in the group, and, when `hidden` counts, a `hide`.
 */
function causes(
  id: string,
  group: string,
  input: GuardrailInput,
  hidden = false
) {
  const ops: (ResolvedOp | undefined)[] = []
  const seen = new Set<string>()
  for (
    let node: string | undefined = id;
    node !== undefined && node !== group && !seen.has(node);
  ) {
    seen.add(node)
    const { container, via } = containerOf(node, input)
    const visible = input.properties.get(node)?.get("visible")?.winner
    const inserted = input.properties.get(node)?.get("inserted")?.winner
    ops.push(
      input.placements.get(node)?.winner,
      via,
      hidden && visible?.check.op.op === "hide" ? visible : undefined,
      inserted?.check.op.op === "remove" ? inserted : undefined,
      container === undefined ? undefined : collapseOf(node, container, input)
    )
    node =
      container !== undefined && isWrapper(container, input)
        ? container
        : undefined
  }
  return ops.filter((op): op is ResolvedOp => op !== undefined)
}

/**
 * A destructive action stays clear of the primary action of its group: ops
 * never leave it closer to the primary one than the base does. A group is
 * a node's slots, wrappers included, or one of its item collections. From
 * far to close, a destructive action is apart, right after the primary
 * one, or above it. In the order the group renders, with wrappers
 * flattened, it is above the primary action when it comes first, and right
 * after it when no shown action sits between them; hidden actions keep
 * their place but don't keep them apart. A demoted or collapsed action,
 * or one in a collapsed wrapper, has left the bar for the overflow: one in
 * the bar is above every one in the overflow, and the overflow is ordered
 * the same way. Every action starts in the bar, in `startOrder`.
 *
 * The violation names the destructive action, and lists the ops that put
 * either action where it is, and, when it is right after the primary one,
 * those that took away an action between them.
 */
export const staysClear: Guardrail = (input) => {
  const flagged = (flag: "primary" | "destructive") =>
    [...input.flags.keys()].filter((id) => input.flags.get(id)?.[flag])
  const destructive = flagged("destructive")
  return flagged("primary").flatMap((primary) => {
    const group = groupNow(primary, input)
    if (
      group === undefined ||
      destructive.length === 0 ||
      !touches(input.op.check.op, group, input)
    ) {
      return []
    }
    const placed = orderNow(group, input)
    const at = new Map(placed.map((entry, index) => [entry.id, index]))
    const base = groupOf(primary, input.known)
    const before = base ? startOrder(base, input) : []
    return destructive.flatMap((action): Violation[] => {
      const own = at.get(action)
      const its = at.get(primary)
      if (own === undefined || its === undefined) {
        return []
      }
      const tier = (id: string) => (placed[at.get(id) ?? -1]?.overflow ? 1 : 0)
      const now =
        action === primary ||
        groupNow(action, input) !== group ||
        tier(action) > tier(primary)
          ? 0
          : tier(action) < tier(primary)
            ? 2
            : closeness(
                placed
                  .filter(
                    ({ id, shown, overflow }) =>
                      (shown || id === action || id === primary) &&
                      (overflow ? 1 : 0) === tier(action)
                  )
                  .map(({ id }) => id),
                action,
                primary
              )
      if (now <= closeness(before, action, primary)) {
        return []
      }
      const moved = [action, primary].flatMap((id) => causes(id, group, input))
      const between = new Set(
        before.slice(before.indexOf(primary) + 1, before.indexOf(action))
      )
      const gone =
        now === 2
          ? []
          : [...between].flatMap((id) => {
              const index = at.get(id)
              const span = index !== undefined && index > its && index < own
              return span || index === undefined || moved.length === 0
                ? causes(id, group, input, true)
                : []
            })
      const ops = [...moved, ...gone]
      return [
        {
          guardrail: "stays-clear",
          flag: "destructive",
          node: action,
          ops: ops.filter((op, index) => ops.indexOf(op) === index),
        },
      ]
    })
  })
}
