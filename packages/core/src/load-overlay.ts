import { overlaySchema } from "@pliantui/contract"

import { checkOp, type OpCheck } from "./check-op"
import type { Result } from "./result"
import type { WithOps } from "./with-ops"

export type LoadedOverlay = WithOps<OpCheck>

export function loadOverlay(input: unknown): Result<LoadedOverlay> {
  const result = overlaySchema.safeParse(input)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return {
    success: true,
    data: { ...result.data, ops: result.data.ops.map(checkOp) },
  }
}
