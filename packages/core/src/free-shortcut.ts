import type { Violation } from "./guardrail"
import { identityOf } from "./node-identity"
import type { OpPropertyKey } from "./op-property"
import { isReservedShortcut, sameShortcut } from "./reserved-shortcuts"
import type { ResolvedOp, ResolvedProperty } from "./resolve-layers"

/**
 * A `bindShortcut` takes only free keys: none the browser, the system or
 * assistive technology reserves, none of `reserved`, which the app binds
 * itself, and none another action's binding on the surface takes so far.
 * Two bindings take the same keys when they press the same keys on
 * Windows and Linux, where `mod` is Ctrl, or on macOS, where it is
 * Command.
 */
export function freeShortcut(
  op: Pick<ResolvedOp, "check">,
  properties: ReadonlyMap<string, ReadonlyMap<OpPropertyKey, ResolvedProperty>>,
  reserved: readonly string[]
): Violation | undefined {
  const bind = op.check.op
  if (bind.op !== "bindShortcut") {
    return undefined
  }
  const node = identityOf(bind.target)
  if (
    isReservedShortcut(bind.keys) ||
    reserved.some((keys) => sameShortcut(keys, bind.keys))
  ) {
    return { guardrail: "free-shortcut", node, ops: [] }
  }
  const taken = [...properties].flatMap(([id, property]) => {
    const winner = property.get("shortcut")?.winner
    const other = winner?.check.op
    return id !== node &&
      winner &&
      other?.op === "bindShortcut" &&
      sameShortcut(other.keys, bind.keys)
      ? [winner]
      : []
  })
  return taken.length > 0
    ? { guardrail: "free-shortcut", node, ops: taken }
    : undefined
}
