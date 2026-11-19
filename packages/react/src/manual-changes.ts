import { opCatalog } from "@pliantui/contract"
import type { LoadedOverlay, ValidatedOverlay } from "@pliantui/core"

import type { LayerContext } from "./layer-context"
import { manualOverlay } from "./manual-overlay"
import { withOps } from "./overlay-list"
import { dependsOnHistory, propertiesOf } from "./property-keys"
import { differingProperties, viewOf } from "./resolved-view"
import { withoutProperties } from "./without-properties"

// Splits the changes made while the preview showed from the rest of the
// session layer, in the order they were made: the session overlays dated
// after it. Both dates come from `tick`, and survive a reload with the
// session layer, so this needs no record of its own.
export function splitManual(
  load: LayerContext["load"],
  session: readonly unknown[],
  previewed: unknown
) {
  const since = Date.parse(load(previewed)?.createdAt ?? "")
  const during = (input: unknown) =>
    Date.parse(load(input)?.createdAt ?? "") > since
  return {
    overlays: session.flatMap((input) =>
      during(input) ? (load(input) ?? []) : []
    ),
    session: session.filter((input) => !during(input)),
  }
}

/**
 * Where the changes made while a preview showed go once it has ended,
 * on top of `below` (the org, team and personal overlays) and `session`:
 * the ones the personal layer accepts as a personal version above the
 * others (above the locked one, too), dropping the earlier session ops
 * they overrode, and the rest in their session overlays, above every other
 * one, where they showed. A change that
 * would render differently from `target` (what showed before the preview
 * ended, less the preview itself on discard), such as a move whose
 * history a session op still depends on, stays in the session layer.
 * `undefined` when even that renders differently, as when a removal
 * applied only in the session layer the preview was in.
 */
export function settleManual(
  context: LayerContext,
  overlays: readonly LoadedOverlay[],
  target: ReturnType<typeof viewOf>,
  below: readonly unknown[],
  session: readonly unknown[]
):
  | { readonly version?: ValidatedOverlay; readonly session: unknown[] }
  | undefined {
  const { load, tick, resolve, validateAbove } = context
  const changes = overlays.flatMap((overlay, at) =>
    overlay.ops.flatMap((check) =>
      check.status === "valid" ? [{ at, index: check.index, op: check.op }] : []
    )
  )
  if (changes.length === 0) {
    return { session: [...session] }
  }
  // A change whose effect depends on history (a move, say) keeps its
  // place in that history: below a session op that also does, it would
  // apply in another order.
  const historyInSession = session.some((input) =>
    load(input)?.ops.some(
      (check) => check.status === "valid" && dependsOnHistory(check.op)
    )
  )
  let toPersonal = new Set(
    changes.filter(
      ({ op }) =>
        opCatalog[op.op].layers.includes("personal") &&
        !(historyInSession && dependsOnHistory(op))
    )
  )
  for (;;) {
    const time = tick()
    const personalOps = changes
      .filter((change) => toPersonal.has(change))
      .map(({ op }) => op)
    const version =
      personalOps.length > 0
        ? validateAbove(
            manualOverlay(context, "personal", personalOps, time),
            below
          )
        : undefined
    if (version && !version.success) {
      toPersonal = new Set()
      continue
    }
    const { kept: trimmed } = withoutProperties(
      load,
      session,
      new Set(
        personalOps.flatMap((op) =>
          dependsOnHistory(op) ? [] : propertiesOf(op)
        )
      )
    )
    // Restamped, so they sort after every session overlay made before,
    // such as the one `lockIn` keeps.
    const left = overlays.flatMap((overlay, at) => {
      const keep = (index: number) =>
        changes.some(
          (change) =>
            change.at === at &&
            change.index === index &&
            !toPersonal.has(change)
        )
      return overlay.ops.some((check) => keep(check.index))
        ? [
            {
              ...withOps(overlay, (index) =>
                keep(overlay.ops[index]?.index ?? -1)
              ),
              createdAt: new Date(tick()).toISOString(),
            },
          ]
        : []
    })
    const nextSession = [...trimmed, ...left]
    const differing = differingProperties(
      target,
      viewOf(
        resolve([...below, ...(version ? [version.data] : []), ...nextSession])
      )
    )
    if (differing.size === 0) {
      return {
        ...(version ? { version: version.data } : {}),
        session: nextSession,
      }
    }
    if (toPersonal.size === 0) {
      return undefined
    }
    const involved = [...toPersonal].filter(({ op }) =>
      propertiesOf(op).some((property) => differing.has(property))
    )
    toPersonal =
      involved.length > 0
        ? new Set(
            [...toPersonal].filter((change) => !involved.includes(change))
          )
        : new Set()
  }
}
