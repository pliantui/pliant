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

function opsOf(input: unknown): [OverlayOp, number][] {
  if (
    typeof input !== "object" ||
    input === null ||
    !("ops" in input) ||
    !Array.isArray(input.ops)
  ) {
    return []
  }
  const ops: unknown[] = input.ops
  return ops.flatMap((op, index): [OverlayOp, number][] => {
    const result = overlayOpSchema.safeParse(op)
    return result.success ? [[result.data, index]] : []
  })
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
  const opsListFailed =
    result.error?.issues.some(
      ({ path }) => path.length === 1 && path[0] === "ops"
    ) ?? false
  const ops = result.success
    ? result.data.ops.map((op, index): [OverlayOp, number] => [op, index])
    : opsListFailed
      ? []
      : opsOf(input)
  const checks = ops.map(([op, index]) => checkOp(op, index))
  const issues = [
    ...(result.success ? [] : result.error.issues),
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
