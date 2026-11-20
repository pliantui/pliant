import type { Flags } from "@pliantui/contract"

import type { OpPropertyKey } from "./op-property"
import type {
  ResolvedItemPlacement,
  ResolvedOp,
  ResolvedProperty,
} from "./resolve-layers"

/** The resolved state a guardrail checks, and what it knows about nodes. */
export interface GuardrailInput {
  readonly properties: ReadonlyMap<
    string,
    ReadonlyMap<OpPropertyKey, ResolvedProperty>
  >
  readonly placements: ReadonlyMap<string, ResolvedItemPlacement>
  /** Instance flags by identity. */
  readonly flags: ReadonlyMap<string, Flags>
  /** Each known node's or item's parent in the base, by identity. */
  readonly parents: ReadonlyMap<string, string>
}

/**
 * A rule the resolved state breaks, named after what it enforces, with the
 * flag and flagged node it protects, and the applied ops that together
 * break it.
 */
export interface Violation {
  readonly guardrail: "stays-visible"
  readonly flag: "critical" | "required"
  readonly node: string
  readonly ops: readonly ResolvedOp[]
}

export type Guardrail = (input: GuardrailInput) => Violation[]
