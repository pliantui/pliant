import { containerOf } from "./container-of"
import type { Guardrail, GuardrailInput, Violation } from "./guardrail"
import type { ResolvedOp } from "./resolve-layers"

/** `node` and the nodes that hold it in the base, nearest first. */
function baseChain(node: string, parents: ReadonlyMap<string, string>) {
  const chain: string[] = []
  for (
    let id: string | undefined = node;
    id !== undefined && !chain.includes(id);
    id = parents.get(id)
  ) {
    chain.push(id)
  }
  return chain
}

function hides(op: ResolvedOp | undefined, name: string): boolean {
  const check = op?.check.op
  return (
    check?.op === name && !(check.op === "collapse" && check.into === "none")
  )
}

/**
 * Why `node` is out of sight, if it is: a `hide`, `collapse`, `demote` or
 * `remove` on it or on a node that holds it, plus every op that moved the
 * node, or a node on the way up, into the one hidden, unless that node
 * holds it in the base anyway. A node inside a cycle of containers is out
 * of sight too, through the ops that place each node on the cycle.
 */
function hidingOps(
  node: string,
  input: GuardrailInput
): ResolvedOp[] | undefined {
  const base = baseChain(node, input.parents)
  const path: ResolvedOp[] = []
  // Every node visited, with the op that put it in the next one.
  const walk: { id: string; via: ResolvedOp | undefined }[] = []
  for (let id: string | undefined = node; id !== undefined;) {
    const repeat: string = id
    const start = walk.findIndex((step) => step.id === repeat)
    if (start >= 0) {
      const cycle = walk.slice(start).flatMap(({ via }) => (via ? [via] : []))
      return cycle.length > 0 ? cycle : undefined
    }
    // A node that holds it in the base hides it whatever moved it in here.
    if (base.includes(id)) {
      path.length = 0
    }
    const own = input.properties.get(id)
    const { container, via } = containerOf(id, input)
    const collapse =
      container === undefined
        ? undefined
        : input.properties
            .get(container)
            ?.get(`collapse.${id.slice(id.lastIndexOf("/") + 1)}`)
    const candidates: [ResolvedOp | undefined, string][] = [
      [own?.get("visible")?.winner, "hide"],
      [own?.get("inserted")?.winner, "remove"],
      [input.placements.get(id)?.winner, "demote"],
      [collapse?.winner, "collapse"],
    ]
    for (const [op, name] of candidates) {
      if (op && hides(op, name)) {
        const movedIn =
          name === "collapse" && via && input.parents.get(id) !== container
        return [op, ...path, ...(movedIn ? [via] : [])]
      }
    }
    walk.push({ id, via })
    if (via) {
      path.push(via)
    }
    id = container
  }
  return undefined
}

/**
 * Nodes flagged `critical` or `required` stay visible and reachable: no op
 * may hide, collapse, demote or remove them, directly or through a node that
 * holds them. A node with both flags is reported as `critical`.
 */
export const staysVisible: Guardrail = (input) =>
  [...input.flags].flatMap(([node, flags]): Violation[] => {
    const flag = flags.critical
      ? "critical"
      : flags.required
        ? "required"
        : undefined
    const ops = flag && hidingOps(node, input)
    return flag && ops ? [{ guardrail: "stays-visible", flag, node, ops }] : []
  })
