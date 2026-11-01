import type * as z from "zod"

import {
  opCatalog,
  opSchema,
  opSchemas,
  type Op,
  type OpName,
  type OverlayOp,
} from "@pliantui/contract"

export type OpCheck =
  | { index: number; status: "valid"; op: Op }
  | { index: number; status: "unknown"; op: OverlayOp }
  | { index: number; status: "newer"; op: OverlayOp; keys: string[] }
  | { index: number; status: "invalid"; op: OverlayOp; error: z.ZodError }

function isOpName(name: string): name is OpName {
  return Object.hasOwn(opCatalog, name)
}

function argumentKeys(schema: z.ZodType): string[] {
  if ("shape" in schema && typeof schema.shape === "object" && schema.shape) {
    return Object.keys(schema.shape)
  }
  if ("options" in schema && Array.isArray(schema.options)) {
    return schema.options.flatMap((option: z.ZodType) => argumentKeys(option))
  }
  return []
}

export function checkOp(op: OverlayOp, index: number): OpCheck {
  if (!isOpName(op.op)) {
    return { index, status: "unknown", op }
  }
  const known = new Set(argumentKeys(opSchemas[op.op]))
  const keys = Object.keys(op).filter((key) => !known.has(key))
  const result = opSchema.safeParse(
    keys.length > 0
      ? Object.fromEntries(Object.entries(op).filter(([key]) => known.has(key)))
      : op
  )
  if (!result.success) {
    return { index, status: "invalid", op, error: result.error }
  }
  if (keys.length > 0) {
    return { index, status: "newer", op, keys }
  }
  return { index, status: "valid", op: result.data }
}
