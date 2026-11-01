import * as z from "zod"

import {
  overlayOpSchema,
  overlaySchema,
  type Op,
  type OverlayOp,
} from "@pliantui/contract"

import { checkOp, type OpCheck } from "./check-op"
import type { Result } from "./result"
import type { WithOps } from "./with-ops"

export type ValidatedOverlay = WithOps<Op>

const [overlayVariant] = overlaySchema.options
const opsListSchema = overlayVariant.shape.ops

interface OpsOf {
  ops: [OverlayOp, number][]
  issues: z.core.$ZodIssue[]
}

function opsOf(input: unknown): OpsOf {
  if (typeof input !== "object" || input === null || !("ops" in input)) {
    return { ops: [], issues: [] }
  }
  const { ops } = input
  const list = opsListSchema.safeParse(ops)
  if (list.success) {
    return { ops: list.data.map((op, index) => [op, index]), issues: [] }
  }
  const listIssues = list.error.issues.filter(({ path }) => path.length === 0)
  if (!Array.isArray(ops) || listIssues.length > 0) {
    return {
      ops: [],
      issues: listIssues.map((issue) => ({ ...issue, path: ["ops"] })),
    }
  }
  const items: unknown[] = ops
  const result: OpsOf = { ops: [], issues: [] }
  for (const [index, item] of items.entries()) {
    const op = overlayOpSchema.safeParse(item)
    if (op.success) {
      result.ops.push([op.data, index])
    } else {
      result.issues.push(
        ...op.error.issues.map((issue) => ({
          ...issue,
          path: ["ops", index, ...issue.path],
        }))
      )
    }
  }
  return result
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
  const reportedOps = envelopeIssues.some(({ path }) => path[0] === "ops")
  const listFailed = envelopeIssues.some(
    ({ path }) => path.length === 1 && path[0] === "ops"
  )
  const fallback =
    result.success || listFailed ? { ops: [], issues: [] } : opsOf(input)
  const ops = result.success
    ? result.data.ops.map((op, index): [OverlayOp, number] => [op, index])
    : fallback.ops
  const checks = ops.map(([op, index]) => checkOp(op, index))
  const issues = [
    ...envelopeIssues,
    ...(reportedOps ? [] : fallback.issues),
    ...checks.flatMap(issuesOf),
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
