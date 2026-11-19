import {
  Activity,
  use,
  useInsertionEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react"

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
 * apply.
 *
 * Limits, since React runs no effects in hidden content:
 * - Content first rendered hidden registers once it shows.
 * - A hidden region's slots keep the content they had when it was hidden,
 *   until it shows again.
 * - A region the hidden content stops rendering stays registered until this
 *   activity shows or unmounts.
 * - Only `PliantActivity` holds registrations: inside a plain `Activity`, or
 *   a Suspense boundary that suspends again, regions and nodes unregister.
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
  // An insertion effect runs in the same phase as the cleanups of what
  // Activity hides, before React yields: the layout phase can wait, behind a
  // view transition, past the end of the task.
  useInsertionEffect(
    () => (hidden ? store.retention.hold(scope) : undefined),
    [store, scope, hidden]
  )
  // Settles once the content shown again has registered again, in its own
  // layout effects, so what this held is never missing in between.
  useLayoutEffect(() => {
    store.retention.settle()
  }, [store, hidden])
  useLayoutEffect(() => store.retention.settle, [store])
  return (
    <RetainScopeContext value={scope}>
      <Activity mode={mode}>{children}</Activity>
    </RetainScopeContext>
  )
}
