import { useMemo } from "react"

import { resolveForm, type ResolvedForm } from "@pliantui/core"

import { useFieldSchemas, type PliantFormSchema } from "./use-field-schemas"
import { usePliantStatus } from "./use-pliant-status"
import { useResolved } from "./use-resolved"

/**
 * Options of `usePliantFormDefaults`.
 *
 * @experimental
 */
export interface UsePliantFormDefaultsOptions {
  /** The form's schema, as in `usePliantForm`. */
  readonly schema?: PliantFormSchema | undefined
}

type Defaults = ResolvedForm["defaults"]

function sameDefaults(a: Defaults, b: Defaults) {
  return (
    a.size === b.size &&
    [...a].every(
      ([name, value]) =>
        b.has(name) && JSON.stringify(b.get(name)) === JSON.stringify(value)
    )
  )
}

/**
 * The form `id`'s initial values: `defaultValues`, with the default an
 * overlay sets on a field (`setDefault`) in place of the field's own. Only
 * fields named in `defaultValues` take one, and with `schema`, only a value
 * the field's schema accepts. Until the layers load, and on the server, it
 * is `defaultValues` itself.
 *
 * The result keeps its identity until a value changes, so pass a stable
 * `defaultValues`, defined outside the component or memoized. Call it before
 * your form library's hook, and pass the result as values that update the
 * form when they change: `values` in react-hook-form's `useForm`, with
 * `resetOptions: { keepDirtyValues: true }` to keep what the user typed, or
 * `defaultValues` in TanStack Form's `useForm`, which updates a form the
 * user hasn't touched.
 *
 * @experimental
 */
export function usePliantFormDefaults<
  T extends Readonly<Record<string, unknown>>,
>(
  id: string,
  defaultValues: T,
  { schema }: UsePliantFormDefaultsOptions = {}
): T {
  useFieldSchemas("usePliantFormDefaults", id, schema)
  const ready = usePliantStatus().status === "ready"
  const key = Object.keys(defaultValues).join("\n")
  const select = useMemo(() => {
    const fields = key.split("\n").filter(Boolean)
    return (layers: Parameters<typeof resolveForm>[0]) =>
      resolveForm(layers, { id, fields }).defaults
  }, [id, key])
  const defaults = useResolved(select, sameDefaults)
  const shape = schema?.shape
  return useMemo(() => {
    if (!ready || defaults.size === 0) {
      return defaultValues
    }
    const values: Record<string, unknown> = { ...defaultValues }
    for (const [name, value] of defaults) {
      const field =
        shape && Object.hasOwn(shape, name) ? shape[name] : undefined
      const result = field?.["~standard"].validate(value)
      if (result instanceof Promise || result?.issues) {
        continue
      }
      values[name] = value
    }
    // Each value is either the caller's own or one its field's schema
    // accepted.
    return values as T
  }, [ready, defaults, defaultValues, shape])
}
