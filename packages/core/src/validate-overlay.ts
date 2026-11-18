import * as z from "zod"

import {
  layerSchema,
  overlaySchema,
  surfaceSchema,
  type Op,
} from "@pliantui/contract"

import { checkOp, type OpCheck, type OpContext } from "./check-op"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { scopeKeyOf } from "./overlay-scope"
import { ownEntries } from "./own-entries"
import { applyOp, createResolution } from "./resolution"
import type { Result } from "./result"
import { surfaceOrder } from "./surface-order"
import type { WithOps } from "./with-ops"

export type ValidatedOverlay = WithOps<Op>

/** The layers an overlay will apply on top of, as plain data. */
export interface ValidateOverlayLayers {
  /**
   * The saved overlays below the new one, as stored: what `loadOverlay`
   * reads. Overlays that don't load are left out, as they can't be resolved
   * either. An overlay with the new overlay's id is left out too, since the
   * new overlay replaces it.
   */
  readonly overlays: readonly unknown[]
  /** The surface the layers resolve for, as in `resolveLayers`. */
  readonly surface: string
  /**
   * The surface's known node ids, as in `resolveLayers`: exact when given,
   * approximated from the ops when omitted.
   */
  readonly baseIds?: readonly string[] | undefined
  /** Team ids, highest precedence first, as in `resolveLayers`. */
  readonly teamOrder?: readonly string[] | undefined
}

export interface ValidateOverlayOptions {
  /**
   * The layers the overlay will apply on top of. The overlay is validated as
   * if it applied last, after all of them, so pass only the layers below it.
   * When given, the overlay must be for `layers.surface` or `@app`, and an
   * `insert` or `wrap` whose id is already used on the surface is invalid,
   * exactly as `resolveLayers` would report it (`id-collision`). Throws a
   * `TypeError` when `layers.surface` isn't a string.
   */
  readonly layers?: ValidateOverlayLayers | undefined
}

const [overlayVariant] = overlaySchema.out.options
const opsListSchema = overlayVariant.shape.ops

interface Fallback {
  ops: unknown[]
  issues: z.core.$ZodIssue[]
  context: OpContext
}

function fallbackOf(input: Record<string, unknown> | undefined): Fallback {
  if (input === undefined) {
    return { ops: [], issues: [], context: {} }
  }
  const { ops } = input
  const layer = layerSchema.safeParse(input["layer"]).data
  const surface = surfaceSchema.safeParse(input["surface"]).data
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
          message: `Unrecognized ${check.keys.length === 1 ? "key" : "keys"}: ${check.keys.map((key) => JSON.stringify(key)).join(", ")}`,
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

function layerIssues(
  overlay: LoadedOverlay,
  { overlays, surface, baseIds, teamOrder = [] }: ValidateOverlayLayers
): z.core.$ZodIssue[] {
  const below = overlays.flatMap((input) => {
    const loaded = loadOverlay(input)
    return loaded.success && loaded.data.id !== overlay.id ? [loaded.data] : []
  })
  const ordered = surfaceOrder(below, surface, teamOrder)
  if (overlay.surface !== surface && overlay.surface !== "@app") {
    return [
      {
        code: "custom",
        path: ["surface"],
        message: `Must be ${surface} or @app, the surface of the layers`,
      },
    ]
  }
  const state = createResolution(baseIds)
  for (const { overlay: lower, reason } of ordered) {
    const scope = scopeKeyOf(lower)
    for (const check of lower.ops) {
      if (!reason && check.status === "valid") {
        applyOp(state, { check, overlay: lower }, scope)
      }
    }
  }
  const scope = scopeKeyOf(overlay)
  return overlay.ops.flatMap((check): z.core.$ZodIssue[] => {
    if (
      check.status !== "valid" ||
      applyOp(state, { check, overlay }, scope) !== "id-collision"
    ) {
      return []
    }
    const { op, index } = check
    return op.op === "insert" || op.op === "wrap"
      ? [
          {
            code: "custom",
            path:
              op.op === "insert"
                ? ["ops", index, "node", "id"]
                : ["ops", index, "id"],
            message: `The id ${op.op === "insert" ? op.node.id : op.id} is already used on this surface`,
          },
        ]
      : []
  })
}

export function validateOverlay(
  input: unknown,
  { layers }: ValidateOverlayOptions = {}
): Result<ValidatedOverlay> {
  const entries = ownEntries(input)
  const result = overlaySchema.safeParse(entries ?? input)
  const envelopeIssues = result.error?.issues ?? []
  const skipOps = envelopeIssues.some(
    (issue) =>
      (issue.path.length === 1 && issue.path[0] === "ops") ||
      (issue.code === "custom" && issue.params?.["reservedKey"] === true)
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
    : skipOps
      ? { ops: [], issues: [], context: {} }
      : fallbackOf(entries)
  const checks = ops.map((op, index) => checkOp(op, index, context))
  const issues = [
    ...envelopeIssues,
    ...listIssues,
    ...checks.flatMap(issuesOf),
    ...(result.success && layers
      ? layerIssues({ ...result.data, ops: checks }, layers)
      : []),
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
