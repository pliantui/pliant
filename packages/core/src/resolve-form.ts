import type { Op } from "@pliantui/contract"

import { orderItems } from "./order-items"
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
  { properties, placements }: Pick<ResolvedLayers, "properties" | "placements">,
  { id, fields }: ResolveFormOptions
): ResolvedForm {
  const form = properties.get(id)
  const defaults = new Map<string, DefaultValue>()
  const order = orderItems(fields, (field) => {
    const placement = placements.get(`${id}/fields/${field}`)
    return placement?.container === id ? placement.position : undefined
  })
  const entries = order.map((field) => {
    const own = properties.get(`${id}/fields/${field}`)
    const setDefault = own?.get("default")?.winner.check.op
    if (setDefault?.op === "setDefault") {
      defaults.set(field, setDefault.value)
    }
    const position = placements.get(`${id}/fields/${field}`)?.position
    const pin =
      position && "pin" in position && position.pin !== "none"
        ? position.pin
        : undefined
    const collapse = form?.get(`collapse.${field}`)?.winner.check.op
    return {
      kind: "slot" as const,
      id: field,
      visible: own?.get("visible")?.winner.check.op.op !== "hide",
      ...(pin && { pinned: pin }),
      ...(collapse?.op === "collapse" &&
        collapse.into !== "none" && {
          collapsed: {
            into: collapse.into,
            ...(collapse.label !== undefined && { label: collapse.label }),
          },
        }),
    }
  })
  return { entries, defaults }
}
