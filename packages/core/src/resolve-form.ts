import type { Op } from "@pliantui/contract"

import { resolveItems } from "./resolve-items"
import type { ResolvedLayers } from "./resolve-layers"
import type { RegionEntry } from "./resolve-region"

type DefaultValue = Extract<Op, { op: "setDefault" }>["value"]

/** What a form renders, from `resolveForm`. */
export interface ResolvedForm {
  /**
   * The form's fields in render order, hidden ones included, as region
   * entries of kind `slot` whose `id` is the field's name.
   */
  readonly entries: readonly Extract<RegionEntry, { kind: "slot" }>[]
  /** Each field's default from `setDefault`, by field name. */
  readonly defaults: ReadonlyMap<string, DefaultValue>
}

/** The form `resolveForm` resolves. */
export interface ResolveFormOptions {
  /** The form's node id. */
  readonly id: string
  /** The form's field names in base order. */
  readonly fields: readonly string[]
}

/**
 * Resolves a form's fields from the resolved layers: their order, and each
 * field's visibility, pin, collapse and default. Fields are the items of the
 * form's `fields` collection (`ticket-form/fields/priority`); ops on names
 * that aren't in `fields` are ignored, and repeated names count once.
 *
 * Fields never leave their form, so the order is the base order with each
 * field's position applied as `orderItems` does, hidden fields included.
 * A collapsed field keeps its place: render it hidden where it is, under a
 * trigger at the place of the first field of its collapse, never in a new
 * parent.
 */
export function resolveForm(
  layers: Pick<ResolvedLayers, "properties" | "placements">,
  { id, fields }: ResolveFormOptions
): ResolvedForm {
  const entries = resolveItems(layers, id, "fields", fields)
  const defaults = new Map<string, DefaultValue>()
  for (const { id: field } of entries) {
    const setDefault = layers.properties
      .get(`${id}/fields/${field}`)
      ?.get("default")?.winner.check.op
    if (setDefault?.op === "setDefault") {
      defaults.set(field, setDefault.value)
    }
  }
  return { entries, defaults }
}
