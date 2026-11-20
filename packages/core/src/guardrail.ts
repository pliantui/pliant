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
 * flag and flagged node it protects. `ops` are every applied op that
 * together break it, the op that decides first. Resolution skips the one
 * among `ops` that applied last, which is the one from the highest layer.
 * When that is the deciding op, `next` lists the ops that would decide the
 * same way once it is skipped, nearest first, so they can be skipped in the
 * same pass while they too applied after every other op in `ops`.
 */
export interface Violation {
  readonly guardrail: "stays-visible"
  readonly flag: "critical" | "required"
  readonly node: string
  readonly ops: readonly ResolvedOp[]
  readonly next: readonly ResolvedOp[]
}

export type Guardrail = (input: GuardrailInput) => Violation[]
