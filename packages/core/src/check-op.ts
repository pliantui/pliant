import * as z from "zod"

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

interface Branch {
  schema: z.core.$ZodType
  keys: ReadonlySet<string>
}

function branchesOf(schema: z.core.$ZodType): Branch[] {
  if (schema instanceof z.core.$ZodObject) {
    return [{ schema, keys: new Set(Object.keys(schema._zod.def.shape)) }]
  }
  if (schema instanceof z.core.$ZodUnion) {
    return schema._zod.def.options.flatMap(branchesOf)
  }
  throw new TypeError(`Unsupported op schema type: ${schema._zod.def.type}`)
}

function isOpName(name: string): name is OpName {
  return Object.hasOwn(opCatalog, name)
}

export const opBranches: ReadonlyMap<OpName, Branch[]> = new Map(
  Object.keys(opSchemas)
    .filter(isOpName)
    .map((name) => [name, branchesOf(opSchemas[name])])
)

function extraKeys(op: OverlayOp, keys: ReadonlySet<string>) {
  return Object.keys(op).filter((key) => !keys.has(key))
}

export function checkOp(op: OverlayOp, index: number): OpCheck {
  if (!isOpName(op.op)) {
    return { index, status: "unknown", op }
  }
  const result = opSchema.safeParse(op)
  if (result.success) {
    return { index, status: "valid", op: result.data }
  }
  for (const { schema, keys } of opBranches.get(op.op) ?? []) {
    const extra = extraKeys(op, keys)
    if (
      extra.length > 0 &&
      z.safeParse(
        schema,
        Object.fromEntries(Object.entries(op).filter(([key]) => keys.has(key)))
      ).success
    ) {
      return { index, status: "newer", op, keys: extra }
    }
  }
  return { index, status: "invalid", op, error: result.error }
}
