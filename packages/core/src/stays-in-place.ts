import type { Violation } from "./guardrail"
import { identityOf } from "./node-identity"
import type { ResolvedOp } from "./resolve-layers"

/**
 * Form fields never change parent: a `wrap` never takes a field of the form
 * it targets, since a new parent remounts the field and loses its focus,
 * its local state and possibly its value. `fields` holds the known fields
 * by identity. A field can't `move` into another node at all, and a
 * `collapse` keeps fields in place, so these are the only ops to check.
 */
export function staysInPlace(
  op: Pick<ResolvedOp, "check">,
  fields: ReadonlySet<string>
): Violation | undefined {
  const wrap = op.check.op
  if (wrap.op !== "wrap") {
    return undefined
  }
  const form = identityOf(wrap.target)
  const node = wrap.items
    .map((item) => `${form}/fields/${item}`)
    .find((field) => fields.has(field))
  return node === undefined
    ? undefined
    : { guardrail: "stays-in-place", node, ops: [] }
}
