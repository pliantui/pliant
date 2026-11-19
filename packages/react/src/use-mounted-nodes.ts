import { use, useLayoutEffect } from "react"

import { useLayerStore } from "./pliant-context"
import { RetainScopeContext } from "./retain-scope-context"

/**
 * Registers node ids as mounted while the calling component is, so ops into
 * them apply instead of staying dormant. Changes are batched, and resolve
 * again only when the set of mounted ids changes. Pass a stable `ids` array
 * (memoized, or from props); a new array registers again after each render,
 * which is cheap but not free. Inside a hidden `PliantActivity`, the ids stay
 * registered.
 *
 * @experimental
 */
export function useMountedNodes(ids: readonly string[]) {
  const store = useLayerStore("useMountedNodes")
  const scope = use(RetainScopeContext)
  useLayoutEffect(() => {
    const unregister = store.registerNodes(ids)
    return () => {
      store.retention.release(scope, unregister)
    }
  }, [store, scope, ids])
}
