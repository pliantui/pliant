import * as z from "zod"

import { overlaySchema, type Op } from "@pliantui/contract"

import { checkOp } from "./check-op"
import type { Result } from "./result"
import type { WithOps } from "./with-ops"

export type ValidatedOverlay = WithOps<Op>

export function validateOverlay(input: unknown): Result<ValidatedOverlay> {
  const result = overlaySchema.safeParse(input)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  const ops: Op[] = []
  const issues: z.core.$ZodIssue[] = []
  for (const check of result.data.ops.map(checkOp)) {
    const path = ["ops", check.index]
    switch (check.status) {
      case "valid":
        ops.push(check.op)
        break
      case "invalid":
        issues.push(
          ...check.error.issues.map((issue) => ({
            ...issue,
            path: [...path, ...issue.path],
          }))
        )
        break
      case "newer":
        issues.push({
          code: "unrecognized_keys",
          keys: check.keys,
          path,
          message: `Unrecognized ${check.keys.length === 1 ? "key" : "keys"}: ${check.keys.map((key) => `"${key}"`).join(", ")}`,
        })
        break
      case "unknown":
        issues.push({
          code: "custom",
          path: [...path, "op"],
          message: `Unknown op ${check.op.op}`,
        })
        break
    }
  }
  if (issues.length > 0) {
    return { success: false, error: new z.ZodError(issues) }
  }
  return { success: true, data: { ...result.data, ops } }
}
