import * as z from "zod"

import { overlaySchema, type Op, type Overlay } from "@pliantui/contract"

import { checkOp } from "./load-overlay"

export type ValidateOverlayResult =
  | { success: true; data: { overlay: Overlay; ops: Op[] } }
  | { success: false; error: z.ZodError }

export function validateOverlay(input: unknown): ValidateOverlayResult {
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
      case "unknown":
      case "newer":
        issues.push({
          code: "custom",
          path: [...path, "op"],
          message:
            check.status === "unknown"
              ? `Unknown op ${check.op.op}`
              : `${check.op.op} has arguments this version doesn't support`,
          input: check.op,
        })
        break
    }
  }
  if (issues.length > 0) {
    return { success: false, error: new z.ZodError(issues) }
  }
  return { success: true, data: { overlay: result.data, ops } }
}
