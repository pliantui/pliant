import { orderItems } from "./order-items"
import type { PlacementPosition } from "./placement"
import type { ResolvedLayers } from "./resolve-layers"

interface ColumnLayoutBase {
  readonly columnOrder?: readonly string[] | undefined
  readonly columnPinning?:
    | { readonly start: readonly string[]; readonly end: readonly string[] }
    | undefined
}

/**
 * A table's `columnOrder` and `columnPinning`, from its base state and each
 * column's resolved position, as `compileTableState` documents them. `ids`
 * are the table's unique column ids, in definition order.
 */
export function layoutColumns(
  ids: readonly string[],
  base: ColumnLayoutBase,
  positionOf: (column: string) => PlacementPosition | undefined
) {
  const known = new Set(ids)
  const baseOrder = [
    ...new Set([
      ...(base.columnOrder ?? []).filter((id) => known.has(id)),
      ...ids,
    ]),
  ]
  const columnOrder = orderItems(baseOrder, positionOf)
  const pinnedBy = (column: string) => {
    const position = positionOf(column)
    return position && "pin" in position ? position.pin : undefined
  }
  const pinned = (where: "start" | "end") => [
    ...(base.columnPinning?.[where] ?? []).filter(
      (column) => pinnedBy(column) === undefined
    ),
    ...columnOrder.filter((column) => {
      const pin = pinnedBy(column)
      return pin === where || (where === "start" && pin === "sticky")
    }),
  ]
  return {
    columnOrder,
    columnPinning: { start: pinned("start"), end: pinned("end") },
  }
}

/**
 * Each column's resolved position in the table `node` (an identity), for the
 * columns a placement op placed there.
 */
export function columnPositions(
  placements: ResolvedLayers["placements"],
  node: string,
  ids: readonly string[]
) {
  const positions = new Map<string, PlacementPosition | undefined>()
  for (const column of ids) {
    const placement = placements.get(`${node}/columns/${column}`)
    if (placement?.container === node) {
      positions.set(column, placement.position)
    }
  }
  return positions
}
