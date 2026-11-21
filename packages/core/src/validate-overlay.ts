import * as z from "zod"

import {
  layerSchema,
  overlaySchema,
  surfaceSchema,
  type Flags,
  type Manifest,
  type Op,
} from "@pliantui/contract"

import { checkOp, type OpCheck, type OpContext } from "./check-op"
import type { FieldSchema } from "./field-schema"
import { loadOverlay, type LoadedOverlay } from "./load-overlay"
import { identityOf } from "./node-identity"
import { ownEntries } from "./own-entries"
import { readBaseOrder } from "./read-base-order"
import { readBaseParents } from "./read-base-parents"
import { readFields } from "./read-fields"
import { readFlags, type ReadFlags } from "./read-flags"
import { readManifests } from "./read-manifests"
import { readShortcuts } from "./read-shortcuts"
import { readBaseIds } from "./resolution"
import type { SkippedOp } from "./resolve-layers"
import { resolveOrdered, type OpRules } from "./resolve-ordered"
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
  /** The surface's node tree, as in `resolveLayers`. */
  readonly baseParents?: Readonly<Record<string, string | null>> | undefined
  /** Each node's children in render order, as in `resolveLayers`. */
  readonly baseOrder?: Readonly<Record<string, readonly string[]>> | undefined
  /** The manifests of the surface's nodes by address, as in `resolveLayers`. */
  readonly manifests?: Readonly<Record<string, Manifest>> | undefined
  /** Keys your app binds itself, as in `resolveLayers`. */
  readonly reservedShortcuts?: readonly string[] | undefined
  /** The schemas of the surface's form fields, as in `resolveLayers`. */
  readonly fields?: Readonly<Record<string, FieldSchema>> | undefined
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
   * an array of ids or `{ ids, source }` with an array, or `layers.flags`,
   * `layers.baseParents`, `layers.baseOrder`, `layers.manifests`,
   * `layers.reservedShortcuts` or `layers.fields` aren't valid as in
   * `resolveLayers`, whatever the input, and when a field's schema
   * validates asynchronously.
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

/** Why a guardrail skips the op, in the words of an issue. */
function guardrailMessage(skip: Extract<SkippedOp, { reason: "guardrail" }>) {
  const { op } = skip.check
  const item = `The item ${skip.node}`
  switch (skip.guardrail) {
    case "stays-visible":
      return `${item} is ${skip.flag}, so it must stay visible`
    case "stays-clear":
      return `${item} is destructive, so it can't sit next to or above its group's primary action`
    case "free-shortcut": {
      const keys = op.op === "bindShortcut" ? op.keys : ""
      const [other] = skip.conflictsWith
      return other
        ? `${item} can't take ${keys}, which ${identityOf(other.check.op.target)} already takes`
        : `${item} can't take ${keys}, which is reserved`
    }
    case "keeps-meaning": {
      const [prop, value] = op.op === "setProp" ? [op.prop, op.value] : []
      return skip.flag
        ? `${item} is destructive, so its ${String(prop)} can't change`
        : `${item} can't take ${String(prop)} ${String(value)}, which only the app assigns`
    }
    case "valid-default":
      return `${item} doesn't accept this default`
    case "stays-in-place":
      return `${item} is a form field, so it can't move into a new parent`
  }
}

function layerIssues(
  overlay: LoadedOverlay,
  { overlays, surface, baseIds, teamOrder = [] }: ValidateOverlayLayers,
  flags: ReadFlags | undefined,
  baseParents: ReadonlyMap<string, string | null> | undefined,
  baseOrder: ReadonlyMap<string, readonly string[]> | undefined,
  rules: OpRules
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
    flags,
    baseParents,
    baseOrder,
    rules
  )
  const issues = new Map<number, z.core.$ZodIssue>()
  for (const entry of skipped) {
    if (entry.overlay === overlay && entry.reason === "guardrail") {
      issues.set(entry.check.index, {
        code: "custom",
        path: ["ops", entry.check.index],
        message: guardrailMessage(entry),
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
  let baseParents: ReadonlyMap<string, string | null> | undefined
  let baseOrder: ReadonlyMap<string, readonly string[]> | undefined
  let rules: OpRules | undefined
  if (layers) {
    checkSurface(layers.surface)
    const baseIds = readBaseIds(layers.baseIds)
    if (baseIds && !Array.isArray(baseIds.ids)) {
      throw new TypeError("layers.baseIds must list node ids in an array")
    }
    flags = readFlags(layers.flags, "layers.flags")
    baseParents = readBaseParents(
      layers.baseParents,
      flags,
      "layers.baseParents"
    )
    baseOrder = readBaseOrder(
      layers.baseOrder,
      baseParents,
      flags,
      "layers.baseOrder"
    )
    rules = {
      manifests: readManifests(layers.manifests, "layers.manifests"),
      reservedShortcuts: readShortcuts(
        layers.reservedShortcuts,
        "layers.reservedShortcuts"
      ),
      fields: readFields(layers.fields, "layers.fields"),
    }
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
    ...(result.success && layers && rules
      ? layerIssues(
          { ...result.data, ops: checks },
          layers,
          flags,
          baseParents,
          baseOrder,
          rules
        )
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
