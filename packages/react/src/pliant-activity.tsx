import {
  Activity,
  use,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
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
  const holds = useRef<(() => void)[]>([])
  // Holds in an insertion effect, in the phase where React cleans up what
  // Activity hides, and lets go in a layout effect, once content shown again
  // has registered again in its own layout effects: a view transition can
  // defer the layout phase past the next microtask, and nothing must be
  // released in between.
  useInsertionEffect(() => {
    if (hidden) {
      holds.current.push(store.retention.hold(scope))
    }
  }, [store, scope, hidden])
  useLayoutEffect(() => {
    if (!hidden) {
      for (const drop of holds.current.splice(0)) {
        drop()
      }
    }
    store.retention.settle()
  }, [store, hidden])
  // Unlike layout cleanups, insertion cleanups run when this unmounts inside
  // hidden content, and not when an Activity around it hides.
  useInsertionEffect(
    () => () => {
      for (const drop of holds.current.splice(0)) {
        drop()
      }
      store.retention.settle()
    },
    [store]
  )
  return (
    <RetainScopeContext value={scope}>
      <Activity mode={mode}>{children}</Activity>
    </RetainScopeContext>
  )
}
