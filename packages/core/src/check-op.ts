import * as z from "zod"

import {
  opCatalog,
  opSchema,
  overlayOpSchema,
  type Layer,
  type Op,
  type OpName,
  type OverlayOp,
} from "@pliantui/contract"

import { ownEntries } from "./own-entries"

export type OpCheck =
  | { index: number; status: "valid"; op: Op }
  | { index: number; status: "unknown"; op: OverlayOp }
  | { index: number; status: "newer"; op: OverlayOp; keys: string[] }
  | { index: number; status: "invalid"; op: unknown; error: z.ZodError }

export interface OpContext {
  layer?: Layer | undefined
  surface?: string | undefined
}

function isOpName(name: string): name is OpName {
  return Object.hasOwn(opCatalog, name)
}

function contextIssues(
  { op, target }: { op: OpName; target: string },
  { layer, surface }: OpContext
): z.core.$ZodIssue[] {
  const issues: z.core.$ZodIssue[] = []
  if (layer !== undefined && !opCatalog[op].layers.includes(layer)) {
    issues.push({
      code: "custom",
      path: ["op"],
      message: `${op} isn't allowed in the ${layer} layer`,
    })
  }
  if (surface !== undefined && (target === "@app") !== (surface === "@app")) {
    issues.push({
      code: "custom",
      path: ["target"],
      message: "Ops target @app exactly when the overlay's surface is @app",
    })
  }
  return issues
}

export function checkOp(
  input: unknown,
  index: number,
  context: OpContext = {}
): OpCheck {
  const entries = ownEntries(input)
  const envelope = overlayOpSchema.safeParse(entries ?? input)
  if (!envelope.success) {
    return { index, status: "invalid", op: input, error: envelope.error }
  }
  const op: OverlayOp = {
    ...entries,
    op: envelope.data.op,
    target: envelope.data.target,
  }
  if (!isOpName(op.op)) {
    return { index, status: "unknown", op }
  }
  const issues = contextIssues({ op: op.op, target: op.target }, context)
  const known = new Set(["op", "target", ...opCatalog[op.op].args.flat()])
  const keys = Object.keys(op).filter((key) => !known.has(key))
  const result = opSchema.safeParse(op)
  if (result.success && keys.length === 0) {
    return issues.length === 0
      ? { index, status: "valid", op: result.data }
      : { index, status: "invalid", op, error: new z.ZodError(issues) }
  }
  if (
    keys.length > 0 &&
    issues.length === 0 &&
    opSchema.safeParse(
      Object.fromEntries(Object.entries(op).filter(([key]) => known.has(key)))
    ).success
  ) {
    return { index, status: "newer", op, keys }
  }
  return {
    index,
    status: "invalid",
    op,
    error: new z.ZodError([
      ...(result.success ? [] : result.error.issues),
      ...issues,
    ]),
  }
}
