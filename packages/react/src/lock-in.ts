import * as z from "zod"

import { opCatalog } from "@pliantui/contract"
import {
  formatError,
  type LoadedOverlay,
  type ValidatedOverlay,
} from "@pliantui/core"

import type { LayerTools } from "./layer-tools"
import {
  settleManual,
  splitManual,
  type SettledChanges,
} from "./manual-changes"
import { withOps, withoutProperties } from "./overlay-list"
import { dependsOnHistory, propertiesOf } from "./property-keys"
import { differingProperties, viewOf } from "./resolved-view"

type LockInPlan =
  | { readonly success: false; readonly error: string }
  | {
      readonly success: true
      readonly locked: ValidatedOverlay | undefined
      readonly kept: ValidatedOverlay | undefined
      readonly settled: SettledChanges
    }

/**
 * Where `lockIn` puts each op of the preview, and where the changes made
 * while it showed go, so the resolved view stays as `shown`. `below` holds
 * the org, team and personal overlays.
 */
export function planLockIn(
  tools: LayerTools,
  below: readonly unknown[],
  session: readonly unknown[],
  previewed: unknown,
  shown: ReturnType<typeof viewOf>
): LockInPlan {
  const { load, tick, generateId, resolve, validateAbove } = tools
  const loadedPreview = load(previewed)
  if (!loadedPreview) {
    return { success: false, error: "There is no preview to lock in" }
  }
  const overlay: LoadedOverlay = loadedPreview
  const manual = splitManual(tools, session, previewed)
  const target =
    manual.overlays.length === 0
      ? shown
      : viewOf(resolve([...below, ...manual.session, previewed]))
  const valid = new Map(
    overlay.ops.flatMap((check) =>
      check.status === "valid" ? [[check.index, check.op] as const] : []
    )
  )
  const propertiesByIndex = new Map(
    [...valid].map(([index, op]) => [index, propertiesOf(op)] as const)
  )
  const time = tick()
  const createdAt = new Date(time).toISOString()
  const lockedId = generateId(time)
  const keptId = generateId(time)

  // Validates the preview's ops at `indices` as one overlay of `layer`,
  // with issues pointing at the preview's own ops.
  function check(
    indices: readonly number[],
    layer: "personal" | "session",
    lower: readonly unknown[]
  ) {
    const result = validateAbove(
      {
        ...withOps(overlay, (index) => indices.includes(index)),
        id: layer === "personal" ? lockedId : keptId,
        layer,
        createdAt,
      },
      lower
    )
    if (result.success) {
      return { success: true as const, overlay: result.data }
    }
    const failing = new Set<number>()
    const issues = result.error.issues.map((issue) => {
      const [first, position, ...rest] = issue.path
      const index =
        first === "ops" && typeof position === "number"
          ? indices[position]
          : undefined
      if (index === undefined) {
        return issue
      }
      failing.add(index)
      return { ...issue, path: ["ops", index, ...rest] }
    })
    return {
      success: false as const,
      failing,
      error: formatError(new z.ZodError(issues)),
    }
  }

  // Moving an op back also moves every locked op that shares a property
  // with it, transitively, so a chain of such ops moves in one round.
  function withoutConnected(
    toPersonal: ReadonlySet<number>,
    moving: Iterable<number>
  ) {
    const remaining = new Set(toPersonal)
    const moved = new Set<number>()
    const queue = [...moving]
    for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
      if (moved.has(next)) {
        continue
      }
      moved.add(next)
      remaining.delete(next)
      const properties = propertiesByIndex.get(next) ?? []
      for (const index of remaining) {
        if (
          propertiesByIndex
            .get(index)
            ?.some((property) => properties.includes(property))
        ) {
          queue.push(index)
        }
      }
    }
    return remaining
  }

  // Session ops whose effect depends on history are never dropped, so a
  // locked op sharing a property with one stays in the session layer.
  const protectedProperties = new Set(
    manual.session.flatMap(
      (input) =>
        load(input)?.ops.flatMap((check) =>
          check.status === "valid" && dependsOnHistory(check.op)
            ? propertiesOf(check.op)
            : []
        ) ?? []
    )
  )
  let toPersonal = withoutConnected(
    new Set(
      [...valid].flatMap(([index, op]) =>
        opCatalog[op.op].layers.includes("personal") ? [index] : []
      )
    ),
    [...valid].flatMap(([index, op]) =>
      !opCatalog[op.op].layers.includes("personal") ||
      propertiesOf(op).some((property) => protectedProperties.has(property))
        ? [index]
        : []
    )
  )

  // Each round compares what the user would see with what they see now,
  // and moves the locked ops involved in a difference (writing a differing
  // property, or having dropped a session op that writes one) back to the
  // session layer, all of them when none is found. Every round moves at
  // least one op, and with none left the preview is a session overlay
  // above every other one, as it was.
  for (;;) {
    const personalIndices = [...valid.keys()].filter((index) =>
      toPersonal.has(index)
    )
    const sessionIndices = [...valid.keys()].filter(
      (index) => !toPersonal.has(index)
    )
    const locked =
      personalIndices.length > 0
        ? check(personalIndices, "personal", below)
        : undefined
    if (locked && !locked.success) {
      toPersonal = withoutConnected(
        toPersonal,
        locked.failing.size > 0 ? locked.failing : toPersonal
      )
      continue
    }
    const { kept: trimmed, dropped } = withoutProperties(
      load,
      manual.session,
      new Set(locked?.overlay.ops.flatMap((op) => propertiesOf(op)))
    )
    const kept =
      sessionIndices.length > 0
        ? check(sessionIndices, "session", [
            ...below,
            ...(locked ? [locked.overlay] : []),
            ...trimmed,
          ])
        : undefined
    if (kept && !kept.success) {
      if (locked) {
        toPersonal = new Set()
        continue
      }
      return { success: false, error: kept.error }
    }
    const nextSession = [...trimmed, ...(kept ? [kept.overlay] : [])]
    if (locked) {
      const differing = differingProperties(
        target,
        viewOf(resolve([...below, locked.overlay, ...nextSession]))
      )
      if (differing.size > 0) {
        const touched = dropped.filter((properties) =>
          properties.some((property) => differing.has(property))
        )
        const involved = personalIndices.filter((index) =>
          (propertiesByIndex.get(index) ?? []).some(
            (property) =>
              differing.has(property) ||
              touched.some((properties) => properties.includes(property))
          )
        )
        toPersonal = withoutConnected(
          toPersonal,
          involved.length > 0 ? involved : personalIndices
        )
        continue
      }
    }
    if (!locked && !kept) {
      return { success: false, error: "The preview has no valid ops" }
    }
    const settled = settleManual(
      tools,
      manual.overlays,
      shown,
      [...below, ...(locked ? [locked.overlay] : [])],
      nextSession
    )
    if (!settled) {
      return {
        success: false,
        error:
          "Couldn't keep this preview as it is. Discard keeps your own changes.",
      }
    }
    return {
      success: true,
      locked: locked?.overlay,
      kept: kept?.overlay,
      settled,
    }
  }
}
