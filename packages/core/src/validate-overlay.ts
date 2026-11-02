import * as z from "zod"

import {
  layerSchema,
  overlaySchema,
  surfaceSchema,
  type Op,
} from "@pliantui/contract"

import { checkOp, type OpCheck, type OpContext } from "./check-op"
import type { Result } from "./result"
import type { WithOps } from "./with-ops"

export type ValidatedOverlay = WithOps<Op>

const [overlayVariant] = overlaySchema.options
const opsListSchema = overlayVariant.shape.ops

interface Fallback {
  ops: unknown[]
  issues: z.core.$ZodIssue[]
  context: OpContext
}

function fallbackOf(input: unknown): Fallback {
  if (typeof input !== "object" || input === null) {
    return { ops: [], issues: [], context: {} }
  }
  const ops = "ops" in input ? input.ops : undefined
  const layer =
    "layer" in input ? layerSchema.safeParse(input.layer).data : undefined
  const surface =
    "surface" in input ? surfaceSchema.safeParse(input.surface).data : undefined
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
          message: `Unrecognized ${check.keys.length === 1 ? "key" : "keys"}: ${check.keys.map((key) => `"${key}"`).join(", ")}`,
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

export function validateOverlay(input: unknown): Result<ValidatedOverlay> {
  const result = overlaySchema.safeParse(input)
  const envelopeIssues = result.error?.issues ?? []
  const listFailed = envelopeIssues.some(
    ({ path }) => path.length === 1 && path[0] === "ops"
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
    : listFailed
      ? { ops: [], issues: [], context: {} }
      : fallbackOf(input)
  const checks = ops.map((op, index) => checkOp(op, index, context))
  const issues = [...envelopeIssues, ...listIssues, ...checks.flatMap(issuesOf)]
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
