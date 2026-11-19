import { Activity, use, useLayoutEffect, useState, type ReactNode } from "react"

import { useLayerStore } from "./pliant-context"
import { RetainScopeContext } from "./retain-scope-context"
import type { RetainScope } from "./retention"

/** @experimental */
export interface PliantActivityProps {
  readonly mode?: "visible" | "hidden" | undefined
  readonly children?: ReactNode
}

/**
 * React's `Activity`, keeping the regions and nodes inside registered while
 * hidden: hidden content stays mounted, so a slot moved out of a hidden
 * region still renders where it was moved, and ops into hidden nodes still
 * apply. Content first rendered hidden registers once it shows.
 *
 * @experimental
 */
export function PliantActivity({
  mode = "visible",
  children,
}: PliantActivityProps) {
  const store = useLayerStore("PliantActivity")
  const parent = use(RetainScopeContext)
  const [scope] = useState<RetainScope>(() => ({ parent, held: 0 }))
  const hidden = mode === "hidden"
  useLayoutEffect(
    () => (hidden ? store.retention.hold(scope) : undefined),
    [store, scope, hidden]
  )
  return (
    <RetainScopeContext value={scope}>
      <Activity mode={mode}>{children}</Activity>
    </RetainScopeContext>
  )
}
