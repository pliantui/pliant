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
 * A rule the resolved state breaks: the flagged node it protects, and every
 * applied op that together break it. Resolution skips the one among `ops`
 * that applied last, which is the one from the highest layer.
 */
export interface Violation {
  readonly guardrail: "critical" | "required"
  readonly node: string
  readonly ops: readonly ResolvedOp[]
}

export type Guardrail = (input: GuardrailInput) => Violation[]
