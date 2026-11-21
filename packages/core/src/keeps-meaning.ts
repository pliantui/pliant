import type { Flags, Manifest } from "@pliantui/contract"

import type { Violation } from "./guardrail"
import { identityOf } from "./node-identity"
import type { ResolvedOp } from "./resolve-layers"

/**
 * Variants keep their meaning: a `setProp` never sets a value its target's
 * manifest marks `semantic`, such as `destructive`, since only the app
 * assigns those. On a node or item flagged `destructive`, a `setProp` never
 * changes a prop that has semantic values at all, so a destructive action
 * keeps the variant that marks it.
 */
export function keepsMeaning(
  op: ResolvedOp,
  manifests: ReadonlyMap<string, Manifest>,
  flags: ReadonlyMap<string, Flags> | undefined
): Violation | undefined {
  const set = op.check.op
  if (set.op !== "setProp") {
    return undefined
  }
  const node = identityOf(set.target)
  const props = manifests.get(node)?.capabilities.props
  const semantic =
    props && Object.hasOwn(props, set.prop)
      ? (props[set.prop]?.semantic ?? [])
      : []
  if (semantic.includes(set.value)) {
    return { guardrail: "keeps-meaning", node, ops: [] }
  }
  return semantic.length > 0 && flags?.get(node)?.destructive
    ? { guardrail: "keeps-meaning", flag: "destructive", node, ops: [] }
    : undefined
}
