import * as z from "zod"

import {
  layerSchema,
  overlaySchema,
  surfaceSchema,
  type Flags,
  type Op,
} from "@pliantui/contract"

import { checkOp, type OpCheck, type OpContext } from "./check-op"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { identityOf } from "./node-identity"
import { ownEntries } from "./own-entries"
import { readBaseIds } from "./resolution"
import { readFlags, resolveOrdered, type ReadFlags } from "./resolve-ordered"
import type { Result } from "./result"
import { checkSurface, surfaceOrder } from "./surface-order"
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
   * The surface's known node ids, as in `resolveLayers`, as plain data: an
   * array of ids (the full inventory), or `{ ids, source }` with `ids` an
   * array. Exact when given, approximated from the ops when omitted.
   */
  readonly baseIds?:
    | readonly string[]
    | {
        readonly ids: readonly string[]
        readonly source: "inventory" | "mounted"
      }
    | undefined
  /** Team ids, highest precedence first, as in `resolveLayers`. */
  readonly teamOrder?: readonly string[] | undefined
  /** The surface's instance flags by address, as in `resolveLayers`. */
  readonly flags?: Readonly<Record<string, Flags>> | undefined
}

/** How `validateOverlay` checks an overlay beyond its own shape. */
export interface ValidateOverlayOptions {
  /**
   * The layers the overlay will apply on top of. The overlay is validated as
   * if it applied last, after all of them, so pass only the layers below it.
   * When given, the overlay must be for `layers.surface` or `@app`, and these
   * are invalid, exactly as `resolveLayers` would report them: an `insert` or
   * `wrap` whose id is already used on the surface (`id-collision`, at the
   * id), and a `move … into` a node that doesn't exist or an `insert` or
   * `wrap` into one (`missing-container`, at `to.into` or `target`). A
   * `dormant` op, into a node that mounted `baseIds` don't list yet, isn't
   * an issue: it applies once the node mounts. An op that `resolveLayers`
   * would skip for breaking a guardrail is invalid too, at the op: with the
   * overlay applied last, it is the highest op involved. Throws a
   * `TypeError` when `layers.surface` isn't a string, `layers.baseIds` isn't
   * an array of ids or `{ ids, source }` with an array, or `layers.flags`
   * isn't an object of valid flags, whatever the input.
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
  { overlays, surface, baseIds, teamOrder = [] }: ValidateOverlayLayers,
  flags: ReadFlags | undefined
): z.core.$ZodIssue[] {
  if (overlay.surface !== surface && overlay.surface !== "@app") {
    return [
      {
        code: "custom",
        path: ["surface"],
        message: `Must be ${surface} or @app, the surface of the layers`,
      },
    ]
  }
  const below = overlays.flatMap((input) => {
    const loaded = loadOverlay(input)
    return loaded.success && loaded.data.id !== overlay.id ? [loaded.data] : []
  })
  const { skipped, unapplied } = resolveOrdered(
    [
      ...surfaceOrder(below, surface, teamOrder),
      { overlay, reason: undefined },
    ],
    baseIds,
    flags
  )
  const issues = new Map<number, z.core.$ZodIssue>()
  for (const entry of skipped) {
    if (entry.overlay === overlay && entry.reason === "guardrail") {
      issues.set(entry.check.index, {
        code: "custom",
        path: ["ops", entry.check.index],
        message: `The node ${entry.node} is ${entry.flag}, so it must stay visible`,
      })
    }
  }
  for (const { overlay: owner, check, reason } of unapplied) {
    const { op, index } = check
    if (owner !== overlay) {
      continue
    }
    if (reason === "missing-container") {
      const into = op.op === "move" && "into" in op.to ? op.to.into : undefined
      issues.set(index, {
        code: "custom",
        path:
          into === undefined
            ? ["ops", index, "target"]
            : ["ops", index, "to", "into"],
        message: `The node ${identityOf(into ?? op.target)} doesn't exist on this surface`,
      })
    } else if (
      reason === "id-collision" &&
      (op.op === "insert" || op.op === "wrap")
    ) {
      issues.set(index, {
        code: "custom",
        path:
          op.op === "insert"
            ? ["ops", index, "node", "id"]
            : ["ops", index, "id"],
        message: `The id ${op.op === "insert" ? op.node.id : op.id} is already used on this surface`,
      })
    }
  }
  return [...issues].sort(([a], [b]) => a - b).map(([, issue]) => issue)
}

export function validateOverlay(
  input: unknown,
  { layers }: ValidateOverlayOptions = {}
): Result<ValidatedOverlay> {
  let flags: ReadFlags | undefined
  if (layers) {
    checkSurface(layers.surface)
    const baseIds = readBaseIds(layers.baseIds)
    if (baseIds && !Array.isArray(baseIds.ids)) {
      throw new TypeError("layers.baseIds must list node ids in an array")
    }
    flags = readFlags(layers.flags, "layers.flags")
  }
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
      ? layerIssues({ ...result.data, ops: checks }, layers, flags)
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
