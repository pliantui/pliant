import type * as z from "zod"

import {
  opCatalog,
  opSchema,
  overlaySchema,
  type Op,
  type Overlay,
  type OverlayOp,
} from "@pliantui/contract"

export type OpCheck =
  | { index: number; status: "valid"; op: Op }
  | { index: number; status: "unknown"; op: OverlayOp }
  | { index: number; status: "newer"; op: OverlayOp }
  | { index: number; status: "invalid"; op: OverlayOp; error: z.ZodError }

export type LoadOverlayResult =
  | { success: true; data: { overlay: Overlay; ops: OpCheck[] } }
  | { success: false; error: z.ZodError }

export function checkOp(op: OverlayOp, index: number): OpCheck {
  if (!Object.hasOwn(opCatalog, op.op)) {
    return { index, status: "unknown", op }
  }
  const result = opSchema.safeParse(op)
  if (result.success) {
    return { index, status: "valid", op: result.data }
  }
  if (result.error.issues.every(({ code }) => code === "unrecognized_keys")) {
    return { index, status: "newer", op }
  }
  return { index, status: "invalid", op, error: result.error }
}

export function loadOverlay(input: unknown): LoadOverlayResult {
  const result = overlaySchema.safeParse(input)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return {
    success: true,
    data: { overlay: result.data, ops: result.data.ops.map(checkOp) },
  }
}
