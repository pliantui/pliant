import { useMemo, type ReactNode } from "react"

import { resolveForm, type ResolvedForm } from "@pliantui/core"

import { useWarnUnscanned } from "./inventory-check"
import { useLayerStore } from "./pliant-context"
import { useFieldSchemas, type PliantFormSchema } from "./use-field-schemas"
import { useMountedNodes } from "./use-mounted-nodes"
import { usePliantStatus } from "./use-pliant-status"
import { useResolved } from "./use-resolved"

/**
 * Options of `usePliantForm`.
 *
 * @experimental
 */
export interface UsePliantFormOptions {
  /**
   * The form's schema. A field whose schema rejects a missing value is
   * required, so no overlay can hide or collapse it, and a default its
   * schema rejects is skipped. A field the schema makes `.optional()` or
   * gives a `.default()` accepts a missing value, so users can hide it.
   */
  readonly schema?: PliantFormSchema | undefined
}

function baseForm(names: readonly string[]): ResolvedForm {
  return {
    entries: names.map((id) => ({ kind: "slot", id, visible: true })),
    defaults: new Map(),
  }
}

/**
 * Declares the form `id` while the calling component is mounted, and
 * returns what it renders: its fields in order, each with its visibility
 * and collapse, resolved with core's `resolveForm`. `fields` holds each
 * field's content by field name, the name your form library knows it by;
 * its key order is the base order. Until the layers load, and on the
 * server, it's the fields in key order, all visible.
 *
 * Fields never leave the form: render every entry in the same parent with
 * its name as the key, so a field is never remounted and keeps its state
 * and its value. Moving a focused field in the DOM blurs it and focuses it
 * again, which reaches your form library's blur handler.
 * `useRegionItems` puts the entries of a collapse after its trigger and
 * opens it when a field inside becomes invalid. Render a hidden field with
 * `PliantActivity`, and a field in a closed collapse with `display: none`
 * rather than a hidden activity: its effects keep running, so your form
 * library keeps validating it and marking it invalid.
 *
 * @experimental
 */
export function usePliantForm(
  id: string,
  fields: Readonly<Record<string, ReactNode>>,
  { schema }: UsePliantFormOptions = {}
): ResolvedForm {
  const store = useLayerStore("usePliantForm")
  const key = Object.keys(fields).join("\n")
  const mounted = useMemo(
    () => [
      id,
      ...key
        .split("\n")
        .filter(Boolean)
        .map((name) => `${id}/fields/${name}`),
    ],
    [id, key]
  )
  useMountedNodes(mounted)
  useFieldSchemas("usePliantForm", id, schema)
  if (process.env.NODE_ENV !== "production") {
    // The condition is the same on every render, so hooks keep their order.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWarnUnscanned(store, mounted.join("\n"))
  }
  const ready = usePliantStatus().status === "ready"
  const layers = useResolved()
  return useMemo(() => {
    const names = key.split("\n").filter(Boolean)
    return ready ? resolveForm(layers, { id, fields: names }) : baseForm(names)
  }, [ready, layers, id, key])
}
