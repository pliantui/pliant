import type { Flags } from "@pliantui/contract"

import type { LoadedOverlay } from "./load-overlay"
import type { OpPropertyKey } from "./op-property"
import type {
  BaseIds,
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
  /** The overlays in resolution order. */
  readonly overlays: readonly LoadedOverlay[]
  readonly baseIds: BaseIds | undefined
  /** Instance flags by identity. */
  readonly flags: ReadonlyMap<string, Flags>
  /** Each known node's or item's parent in the base, by identity. */
  readonly parents: ReadonlyMap<string, string>
  /** The caller's node tree, in the order it lists the nodes; may be empty. */
  readonly tree: ReadonlyMap<string, string | null>
}

/**
 * A rule the resolved state breaks, named after what it enforces, with the
 * flag and flagged node it protects, and the applied ops that together
 * break it.
 */
export type Violation =
  | {
      readonly guardrail: "stays-visible"
      readonly flag: "critical" | "required"
      readonly node: string
      readonly ops: readonly ResolvedOp[]
    }
  | {
      readonly guardrail: "stays-clear"
      readonly flag: "destructive"
      readonly node: string
      readonly ops: readonly ResolvedOp[]
    }

export type Guardrail = (input: GuardrailInput) => Violation[]
