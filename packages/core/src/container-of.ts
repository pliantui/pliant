import type { Op } from "@pliantui/contract"

import type { GuardrailInput } from "./guardrail"
import { identityOf } from "./node-identity"
import type { ResolvedOp } from "./resolve-layers"

function setsContainer(op: Op, container: string): boolean {
  return op.op === "wrap"
    ? op.id === container
    : op.op === "move" &&
        "into" in op.to &&
        identityOf(op.to.into) === container
}

/**
 * The node that holds `id` once every op has applied, and the op that put it
 * there, if one did: a `move … into` or `wrap`, or the `insert` or `wrap`
 * that created it. Otherwise its parent in the base, if known.
 */
export function containerOf(
  id: string,
  { properties, placements, parents }: GuardrailInput
): { container: string | undefined; via: ResolvedOp | undefined } {
  const placement = placements.get(id)
  if (placement) {
    const { container, winner, overridden } = placement
    // A pin, reorder or demote keeps the container an earlier op set.
    const via = winner
      ? [...overridden, winner].findLast(({ check }) =>
          setsContainer(check.op, container)
        )
      : undefined
    return { container, via }
  }
  const created = properties.get(id)?.get("inserted")?.winner
  const op = created?.check.op
  if (created && op && op.op !== "remove") {
    return { container: identityOf(op.target), via: created }
  }
  return { container: parents.get(id), via: undefined }
}
