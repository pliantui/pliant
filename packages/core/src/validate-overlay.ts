import * as z from "zod"

import {
  layerSchema,
  overlaySchema,
  surfaceSchema,
  type Op,
} from "@pliantui/contract"

import { checkOp, type OpCheck, type OpContext } from "./check-op"
import { scopeKeyOf } from "./overlay-scope"
import { ownEntries } from "./own-entries"
import type { ResolvedLayers } from "./resolve-layers"
import type { Result } from "./result"
import type { WithOps } from "./with-ops"
import { nodeIdsOf, wrapCollides, type WrapOwner } from "./wrap-ids"

export type ValidatedOverlay = WithOps<Op>

export interface ValidateOverlayOptions {
  /**
   * The resolved layers the overlay will apply on, from `resolveLayers`. When
   * given, a `wrap` whose id is already used on the surface is invalid.
   */
  readonly resolved?: ResolvedLayers | undefined
}

const [overlayVariant] = overlaySchema.out.options
const opsListSchema = overlayVariant.shape.ops

interface Fallback {
  ops: unknown[]
  issues: z.core.$ZodIssue[]
  context: OpContext
}

function fallbackOf(input: Record<string, unknown> | undefined): Fallback {
  if (input === undefined) {
    return { ops: [], issues: [], context: {} }
  }
  const { ops } = input
  const layer = layerSchema.safeParse(input["layer"]).data
  const surface = surfaceSchema.safeParse(input["surface"]).data
  const context = { layer, surface }
  const list = opsListSchema.safeParse(ops)
  if (list.success) {
    return { ops: list.data, issues: [], context }
  }
  return {
    ops: [],
    issues: list.error.issues.map((issue) => ({ ...issue, path: ["ops"] })),
    context,
  }
}

function issuesOf(check: OpCheck): z.core.$ZodIssue[] {
  const path = ["ops", check.index]
  switch (check.status) {
    case "valid":
      return []
    case "invalid":
      return check.error.issues.map((issue) => ({
        ...issue,
        path: [...path, ...issue.path],
      }))
    case "newer":
      return [
        {
          code: "unrecognized_keys",
          keys: check.keys,
          path,
          message: `Unrecognized ${check.keys.length === 1 ? "key" : "keys"}: ${check.keys.map((key) => JSON.stringify(key)).join(", ")}`,
        },
      ]
    case "unknown":
      return [
        {
          code: "custom",
          path: [...path, "op"],
          message: `Unknown op ${check.op.op}`,
        },
      ]
  }
}

function wrapIdIssues(
  checks: readonly OpCheck[],
  scope: string,
  resolved: ResolvedLayers
): z.core.$ZodIssue[] {
  const valid = checks.flatMap((check) =>
    check.status === "valid" ? [{ index: check.index, op: check.op }] : []
  )
  const ids = nodeIdsOf(
    resolved,
    valid.map(({ op }) => op)
  )
  const own = new Map<string, WrapOwner>()
  const withOwn = { ...ids, wrap: (id: string) => own.get(id) ?? ids.wrap(id) }
  return valid.flatMap(({ index, op }): z.core.$ZodIssue[] => {
    if (op.op !== "wrap") {
      return []
    }
    if (wrapCollides(op, scope, withOwn)) {
      return [
        {
          code: "custom",
          path: ["ops", index, "id"],
          message: `The id ${op.id} is already used on this surface`,
        },
      ]
    }
    own.set(op.id, { scope, target: op.target })
    return []
  })
}

export function validateOverlay(
  input: unknown,
  { resolved }: ValidateOverlayOptions = {}
): Result<ValidatedOverlay> {
  const entries = ownEntries(input)
  const result = overlaySchema.safeParse(entries ?? input)
  const envelopeIssues = result.error?.issues ?? []
  const skipOps = envelopeIssues.some(
    (issue) =>
      (issue.path.length === 1 && issue.path[0] === "ops") ||
      (issue.code === "custom" && issue.params?.["reservedKey"] === true)
  )
  const {
    ops,
    issues: listIssues,
    context,
  } = result.success
    ? {
        ops: result.data.ops,
        issues: [],
        context: { layer: result.data.layer, surface: result.data.surface },
      }
    : skipOps
      ? { ops: [], issues: [], context: {} }
      : fallbackOf(entries)
  const checks = ops.map((op, index) => checkOp(op, index, context))
  const issues = [
    ...envelopeIssues,
    ...listIssues,
    ...checks.flatMap(issuesOf),
    ...(result.success && resolved
      ? wrapIdIssues(checks, scopeKeyOf(result.data), resolved)
      : []),
  ]
  if (!result.success || issues.length > 0) {
    return { success: false, error: new z.ZodError(issues) }
  }
  return {
    success: true,
    data: {
      ...result.data,
      ops: checks.flatMap((check) =>
        check.status === "valid" ? [check.op] : []
      ),
    },
  }
}
