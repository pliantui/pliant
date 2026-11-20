import { compareOrdered } from "./compare-ordered"
import { containerOf } from "./container-of"
import type { Guardrail, GuardrailInput, Violation } from "./guardrail"
import type { ResolvedOp } from "./resolve-layers"
import { resolveRegion } from "./resolve-region"

/**
 * The children of `group` before any op, in order: the nodes the tree lists
 * there, in its order, then the others by identity. Core can't know where
 * an action the tree doesn't list sits, such as an item, so it takes the
 * safest place: a primary action first, a destructive one last.
 */
function baseOrder(group: string, { flags, parents, tree }: GuardrailInput) {
  const listed = [...tree.keys()].filter((id) => tree.get(id) === group)
  const side = (id: string) =>
    flags.get(id)?.primary ? -1 : flags.get(id)?.destructive ? 1 : 0
  const others = [...parents.keys()]
    .filter((id) => parents.get(id) === group && !listed.includes(id))
    .sort((a, b) => side(a) - side(b) || compareOrdered(a, b))
  return [
    ...others.filter((id) => side(id) < 0),
    ...listed,
    ...others.filter((id) => side(id) >= 0),
  ]
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

/**
 * A destructive action stays clear of the primary action of its group, the
 * node that holds the primary one once every op has applied: ops never
 * leave it closer to the primary one than the base does. From far to
 * close, it is apart, right after it, or above it. In the order the group
 * renders, as `resolveRegion` gives it from `baseOrder`, a destructive
 * action is above the primary one when it comes first, and right after it
 * when no shown action sits between them; hidden actions keep their place
 * but don't keep them apart. A demoted or collapsed action has left the
 * group's bar for its overflow: one in the bar is above every one in the
 * overflow, and the overflow is ordered the same way. Every action starts
 * in the bar.
 *
 * The violation names the destructive action, and lists the ops that place
 * either action or collapse it.
 */
export const staysClear: Guardrail = (input) => {
  const flagged = (flag: "primary" | "destructive") =>
    [...input.flags.keys()].filter((id) => input.flags.get(id)?.[flag])
  const destructive = flagged("destructive")
  const layers = { ...input, skipped: [], unapplied: [] }
  return flagged("primary").flatMap((primary) => {
    const group = containerOf(primary, input).container
    if (group === undefined || destructive.length === 0) {
      return []
    }
    const { entries } = resolveRegion(layers, {
      id: group,
      slots: baseOrder(group, input),
    })
    const collapse = (id: string) => {
      const property = input.properties
        .get(group)
        ?.get(`collapse.${id.slice(id.lastIndexOf("/") + 1)}`)
      const op = property?.winner.check.op
      return op?.op === "collapse" && op.into !== "none"
        ? property?.winner
        : undefined
    }
    const tier = (id: string) => {
      const position = input.placements.get(id)?.position
      return collapse(id) ||
        (position && "promoted" in position && !position.promoted)
        ? 1
        : 0
    }
    const base = input.parents.get(primary)
    const before = base === undefined ? [] : baseOrder(base, input)
    return destructive.flatMap((action): Violation[] => {
      const ids = entries.map(({ id }) => id)
      const shown = entries.flatMap(({ id, visible }) =>
        (visible || id === action || id === primary) &&
        tier(id) === tier(action)
          ? [id]
          : []
      )
      const now =
        action === primary ||
        !ids.includes(action) ||
        !ids.includes(primary) ||
        tier(action) > tier(primary)
          ? 0
          : tier(action) < tier(primary)
            ? 2
            : closeness(shown, action, primary)
      if (now <= closeness(before, action, primary)) {
        return []
      }
      const ops = [action, primary].flatMap((id) => [
        containerOf(id, input).via,
        input.placements.get(id)?.winner,
        collapse(id),
      ])
      return [
        {
          guardrail: "stays-clear",
          flag: "destructive",
          node: action,
          ops: ops.filter(
            (op, index): op is ResolvedOp =>
              op !== undefined && ops.indexOf(op) === index
          ),
        },
      ]
    })
  })
}
