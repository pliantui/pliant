import type { FieldSchema } from "./field-schema"
import type { Violation } from "./guardrail"
import { identityOf } from "./node-identity"
import type { ResolvedOp } from "./resolve-layers"

/**
 * A form field's default is valid data: a `setDefault` on a field sets only
 * a value the field's schema accepts. A field with no schema isn't checked,
 * nor is a node's declared default, which no field schema covers.
 *
 * Throws a `TypeError` when the schema validates asynchronously.
 */
export function validDefault(
  op: ResolvedOp,
  schemas: ReadonlyMap<string, FieldSchema>
): Violation | undefined {
  const set = op.check.op
  if (set.op !== "setDefault") {
    return undefined
  }
  const node = identityOf(set.target)
  const result = schemas.get(node)?.["~standard"].validate(set.value)
  if (result instanceof Promise) {
    throw new TypeError(`The schema of ${node} must validate synchronously`)
  }
  return result?.issues
    ? { guardrail: "valid-default", node, ops: [] }
    : undefined
}
