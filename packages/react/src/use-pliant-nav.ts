import { useCallback, useMemo } from "react"

import { resolveNav, type ResolvedNav } from "@pliantui/core"

import { useWarnUnscanned } from "./inventory-check"
import { useLayerStore } from "./pliant-context"
import type { OverlayResult } from "./pliant-store"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantStatus } from "./use-pliant-status"
import { useResolved } from "./use-resolved"

/**
 * What `usePliantNav` returns: the nav's items in order and its landing
 * item, resolved with core's `resolveNav`, and `setLanding`.
 *
 * @experimental
 */
export interface PliantNav extends ResolvedNav {
  /**
   * Makes `item` the user's landing page, saved to their personal layer.
   * Rejected, with the reason, until the layers are ready.
   */
  readonly setLanding: (item: string) => OverlayResult
}

function baseNav(ids: readonly string[]): ResolvedNav {
  return {
    entries: ids.map((id) => ({ kind: "slot", id, visible: true })),
    landing: undefined,
  }
}

/**
 * Declares the nav `id`, such as an app sidebar, while the calling
 * component is mounted, and returns what it renders: its items in order,
 * each with its visibility, pin and collapse, and the landing item the
 * user chose. `items` holds each item by id, as link data or content; its
 * key order is the base order, and each id addresses the item in overlays
 * (`app-sidebar/items/reports`). Until the layers load, and on the server,
 * it's the items in key order, all visible, with no landing.
 *
 * The landing is always an item the user can reach: when they hide the
 * item they landed on, `landing` is `undefined` and your own start page
 * applies. Read it where your app's start route renders, and redirect to
 * the item's page once the layers are ready (see `usePliantStatus`). When
 * the status is `error`, the layers didn't load: redirect to your own start
 * page then, or the start route stays blank.
 *
 * Render a hidden item with `PliantActivity`, or leave it out: a nav item
 * is a link, with no state to keep.
 *
 * @experimental
 */
export function usePliantNav(
  id: string,
  items: Readonly<Record<string, unknown>>
): PliantNav {
  const store = useLayerStore("usePliantNav")
  const key = Object.keys(items).join("\n")
  const mounted = useMemo(
    () => [
      id,
      ...key
        .split("\n")
        .filter(Boolean)
        .map((item) => `${id}/items/${item}`),
    ],
    [id, key]
  )
  useMountedNodes(mounted)
  if (process.env.NODE_ENV !== "production") {
    // The condition is the same on every render, so hooks keep their order.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWarnUnscanned(store, mounted.join("\n"))
  }
  const ready = usePliantStatus().status === "ready"
  const layers = useResolved()
  const { applyOps } = store.actions
  const setLanding = useCallback(
    (item: string) =>
      applyOps("personal", [
        { op: "setLanding", target: `${id}/items/${item}` },
      ]),
    [applyOps, id]
  )
  return useMemo(() => {
    const ids = key.split("\n").filter(Boolean)
    const nav = ready ? resolveNav(layers, { id, items: ids }) : baseNav(ids)
    return { ...nav, setLanding }
  }, [ready, layers, id, key, setLanding])
}
