import { use, useLayoutEffect } from "react"

import type { FieldSchema } from "@pliantui/core"

import { useLayerStore } from "./pliant-context"
import { RetainScopeContext } from "./retain-scope-context"

/**
 * A form's schema: an object schema whose `shape` holds each field's
 * schema by name, such as a Zod object. Each field schema implements
 * Standard Schema and validates synchronously.
 *
 * @experimental
 */
export interface PliantFormSchema {
  readonly shape: Readonly<Record<string, FieldSchema>>
}

/**
 * Gives core the field schemas of the form `id` while the calling component
 * is mounted, so defaults are checked against them and required fields stay
 * visible. Inside a hidden `PliantActivity`, they stay registered.
 */
export function useFieldSchemas(
  hook: string,
  id: string,
  schema: PliantFormSchema | undefined
) {
  const store = useLayerStore(hook)
  const scope = use(RetainScopeContext)
  const shape = schema?.shape
  useLayoutEffect(() => {
    if (!shape) {
      return undefined
    }
    const unregister = store.registerFields(id, shape)
    return () => {
      store.retention.release(scope, unregister)
    }
  }, [store, scope, id, shape])
}
