import type { Filter } from "@pliantui/contract"

import { compareData } from "./compare-data"
import { identityOf } from "./node-identity"
import { orderItems } from "./order-items"
import type { PlacementPosition } from "./placement"
import type { ResolvedLayers } from "./resolve-layers"

type WithoutField<T> = T extends unknown ? Omit<T, "field"> : never

/**
 * A column filter's value: the filter of a `setFilter` op without its
 * `field`, such as `{ operator: "between", value: [10, 100] }`, or
 * `{ operator: "isNull" }`. The React layer registers one TanStack `filterFn`
 * per operator (`pliant:eq`, `pliant:between`, …) that reads this value.
 */
export type PliantFilterValue = WithoutField<Filter>

/**
 * TanStack Table v9 state for a table node, compiled from resolved layers.
 * Each slice has the shape of the TanStack state of the same name.
 */
export interface PliantTableState {
  /** From the table's `sort`: `setSort` replaces the whole list. */
  sorting: { id: string; desc: boolean }[]
  /** From each column's `visible`: `false` after `hide`, `true` after `show`. */
  columnVisibility: Record<string, boolean>
  /** Every column, hidden ones included, in resolved order. */
  columnOrder: string[]
  /** Columns pinned `start` or `sticky`, and `end`, in resolved order. */
  columnPinning: { start: string[]; end: string[] }
  /** From each column's `width`, clamped to its size limits. */
  columnSizing: Record<string, number>
  /** From each column's `filter.<field>`, in the order of `columns`. */
  columnFilters: { id: string; value: PliantFilterValue }[]
}

/** A column's developer-set size limits, as in its TanStack column def. */
export interface ColumnSizeLimits {
  readonly minSize?: number | undefined
  readonly maxSize?: number | undefined
}

/** What `compileTableState` compiles, and against what. */
export interface CompileTableStateOptions {
  /** The table node's id, or its slot address. */
  readonly table: string
  /** The table's column ids, in their base order. */
  readonly columns: readonly string[]
  /** Size limits by column id, which `setColumnWidth` widths clamp to. */
  readonly sizeLimits?: Readonly<Record<string, ColumnSizeLimits>> | undefined
  /**
   * The state compiled last time. Each slice equal to its previous one is
   * returned as that same object, and when every slice is, so is `previous`
   * itself: TanStack recomputes its row models, and resets pagination, when
   * it gets a new object for unchanged state.
   */
  readonly previous?: PliantTableState | undefined
}

const slices = [
  "sorting",
  "columnVisibility",
  "columnOrder",
  "columnPinning",
  "columnSizing",
  "columnFilters",
] as const satisfies readonly (keyof PliantTableState)[]

function reuse<T>(previous: T | undefined, next: T): T {
  return previous !== undefined && compareData(previous, next) === 0
    ? previous
    : next
}

function clamp(width: number, { minSize, maxSize }: ColumnSizeLimits = {}) {
  return Math.min(Math.max(width, minSize ?? -Infinity), maxSize ?? Infinity)
}

/**
 * Compiles a table node's resolved layers into TanStack Table v9 state.
 *
 * Only the ops decide the state: a slice no op sets is empty (`columnOrder`
 * is then `columns`). Sorts and filters on fields that aren't one of
 * `columns` are left out, since TanStack keys its state by column id.
 * Columns are the items of the table's `columns` collection
 * (`orders-table/columns/notes`), ordered by `orderItems`; a `sticky` pin
 * pins to the start, since TanStack pinning is what keeps a column in view.
 */
export function compileTableState(
  { properties, placements }: Pick<ResolvedLayers, "properties" | "placements">,
  { table, columns, sizeLimits = {}, previous }: CompileTableStateOptions
): PliantTableState {
  const node = identityOf(table)
  const known = new Set(columns)
  const tableProperties = properties.get(node)

  const sortOp = tableProperties?.get("sort")?.winner.check.op
  const sorting =
    sortOp?.op === "setSort"
      ? sortOp.sort
          .filter(({ field }) => known.has(field))
          .map(({ field, dir }) => ({ id: field, desc: dir === "desc" }))
      : []

  const columnVisibility: Record<string, boolean> = {}
  const columnSizing: Record<string, number> = {}
  const columnFilters: PliantTableState["columnFilters"] = []
  const positions = new Map<string, PlacementPosition | undefined>()
  for (const column of columns) {
    const identity = `${node}/columns/${column}`
    const columnProperties = properties.get(identity)
    const visible = columnProperties?.get("visible")?.winner.check.op.op
    if (visible === "hide" || visible === "show") {
      columnVisibility[column] = visible === "show"
    }
    const widthOp = columnProperties?.get("width")?.winner.check.op
    if (widthOp?.op === "setColumnWidth") {
      columnSizing[column] = clamp(widthOp.width, sizeLimits[column])
    }
    const filterOp = tableProperties?.get(`filter.${column}`)?.winner.check.op
    if (filterOp?.op === "setFilter") {
      const { field, ...value } = filterOp.filter
      columnFilters.push({ id: field, value })
    }
    const placement = placements.get(identity)
    if (placement?.container === node) {
      positions.set(column, placement.position)
    }
  }

  const columnOrder = orderItems(columns, (column) => positions.get(column))
  const pinned = (where: "start" | "end") =>
    columnOrder.filter((column) => {
      const position = positions.get(column)
      return (
        position !== undefined &&
        "pin" in position &&
        (position.pin === where ||
          (where === "start" && position.pin === "sticky"))
      )
    })

  const next: PliantTableState = {
    sorting: reuse(previous?.sorting, sorting),
    columnVisibility: reuse(previous?.columnVisibility, columnVisibility),
    columnOrder: reuse(previous?.columnOrder, columnOrder),
    columnPinning: reuse(previous?.columnPinning, {
      start: pinned("start"),
      end: pinned("end"),
    }),
    columnSizing: reuse(previous?.columnSizing, columnSizing),
    columnFilters: reuse(previous?.columnFilters, columnFilters),
  }
  return previous && slices.every((slice) => previous[slice] === next[slice])
    ? previous
    : next
}
