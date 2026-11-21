import { useCallback, useMemo, useState } from "react"

import type { ResolvedLayers } from "@pliantui/core"

import { useLayerStore } from "./pliant-context"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantStatus } from "./use-pliant-status"
import { useResolved } from "./use-resolved"

/**
 * Options of `usePliantNavOpen`.
 *
 * @experimental
 */
export interface UsePliantNavOpenOptions {
  /**
   * Whether the nav is open when no layer sets it, such as the value your
   * layout reads from shadcn's `sidebar_state` cookie. Defaults to `true`.
   */
  readonly defaultOpen?: boolean | undefined
}

/**
 * What `usePliantNavOpen` returns: props for a controlled open state, such
 * as shadcn's `SidebarProvider` takes.
 *
 * @experimental
 */
export interface PliantNavOpen {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/**
 * Whether the nav `id` is open, as a default the user keeps: the
 * `defaultOpen` an overlay sets on the nav with
 * `setDefault { prop: "defaultOpen" }`, else `defaultOpen`. When the user
 * opens or closes it, the choice is saved to their personal layer, so it
 * applies on every device the layers reach, and team and org layers can set
 * it for everyone. Changes made within a second replace each other, so
 * toggling it quickly saves one version. Until the layers are ready, and on
 * the server, it's `defaultOpen`; a change made then applies in this tab
 * only.
 *
 * Spread the result on shadcn's `SidebarProvider` inside the nav's
 * `PliantRoot`.
 *
 * @experimental
 */
export function usePliantNavOpen(
  id: string,
  { defaultOpen = true }: UsePliantNavOpenOptions = {}
): PliantNavOpen {
  const { applyOps } = useLayerStore("usePliantNavOpen").actions
  // The nav itself may not be mounted, as in a closed mobile sheet, and
  // its open state still saves.
  useMountedNodes(useMemo(() => [id], [id]))
  const ready = usePliantStatus().status === "ready"
  const select = useCallback(
    ({ properties }: ResolvedLayers) => {
      const set = properties.get(id)?.get("defaults.defaultOpen")?.winner
        .check.op
      // Only a boolean is an open state, whatever a manifest declares.
      return set?.op === "setDefault" && typeof set.value === "boolean"
        ? set.value
        : undefined
    },
    [id]
  )
  const saved = useResolved(select)
  const [unsaved, setUnsaved] = useState<{
    readonly open: boolean
    readonly over: boolean | undefined
  }>()
  // A change the layers couldn't take yet shows until the layers change.
  const local = unsaved?.over === saved ? unsaved?.open : undefined
  const open = local ?? (ready ? saved : undefined) ?? defaultOpen
  const onOpenChange = useCallback(
    (next: boolean) => {
      const result = applyOps("personal", [
        {
          op: "setDefault",
          target: id,
          prop: "defaultOpen",
          value: next,
        },
      ])
      setUnsaved(result.success ? undefined : { open: next, over: saved })
    },
    [applyOps, id, saved]
  )
  return { open, onOpenChange }
}
