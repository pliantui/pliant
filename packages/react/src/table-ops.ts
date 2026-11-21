import type { Layer, Op } from "@pliantui/contract"
import type { ResolvedLayers } from "@pliantui/core"

import { identityOf } from "./node-identity"
import type { PliantTableDataset } from "./table-aggregates"

type WithLayer<T> = T extends unknown ? T & { readonly layer: Layer } : never

/** An op of the given name and the layer it is in. */
export type LayeredOp<Name extends Op["op"]> = Extract<
  WithLayer<Op>,
  { op: Name }
>

/** The ops of a table node with the given name, in the order they applied. */
export function tableOpsOf<Name extends Op["op"]>(
  resolved: ResolvedLayers,
  table: string,
  name: Name
): LayeredOp<Name>[] {
  const properties = resolved.properties.get(identityOf(table))
  return Array.from(properties?.values() ?? [], ({ winner }) => ({
    ...winner.check.op,
    layer: winner.overlay.layer,
  })).filter((op): op is LayeredOp<Name> => op.op === name)
}

/**
 * The time zone `today` reads the current date in, by item id, for the items
 * of the viewer's own layers, where it isn't the dataset's.
 */
export function viewerZones(
  items: readonly { readonly id: string; readonly layer: Layer }[]
): Record<string, string> {
  const { timeZone } = new Intl.DateTimeFormat().resolvedOptions()
  return Object.fromEntries(
    items
      .filter(({ layer }) => layer === "personal" || layer === "session")
      .map(({ id }) => [id, timeZone])
  )
}

/**
 * What an evaluator is created with: the dataset, and the `derived` columns
 * it can read by `ref`, with their expressions and the time zone `today`
 * reads in for each.
 */
export function evaluatorOptions(
  { fields, timeZone }: PliantTableDataset,
  derived: readonly LayeredOp<"addDerived">[]
) {
  return {
    fields,
    timeZone,
    derived: Object.fromEntries(derived.map(({ id, expr }) => [id, expr])),
    todayTimeZones: viewerZones(derived),
  }
}
