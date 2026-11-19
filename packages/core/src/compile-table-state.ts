import type { Filter } from "@pliantui/contract"

import { compareData } from "./compare-data"
import { identityOf } from "./node-identity"
import type { ResolvedLayers } from "./resolve-layers"
import { columnPositions, layoutColumns } from "./table-columns"

type WithoutField<T> = T extends unknown ? Omit<T, "field"> : never

/**
 * The value of a column filter that a `setFilter` op sets: its filter without
 * `field`, such as `{ operator: "between", value: [10, 100] }`, or
 * `{ operator: "isNull" }`. The React layer registers one TanStack `filterFn`
 * per operator (`pliant:eq`, `pliant:between`, …) that reads this value.
 */
export type FilterValue = WithoutField<Filter>

/**
 * TanStack Table v9 state for a table node: the developer's base state with
 * the resolved layers applied on top. Each slice has the shape of the v9
 * state of the same name, so pinning is `start`/`end`; a v8 adapter maps it
 * to `left`/`right`.
 */
export interface CompiledTableState {
  /** The `setSort` that holds replaces the whole list. */
  sorting: { id: string; desc: boolean }[]
  /** `hide` sets a column's entry to `false`, `show` to `true`. */
  columnVisibility: Record<string, boolean>
  /** Every column, hidden ones included, in resolved order. */
  columnOrder: string[]
  /**
   * `pin start` and `sticky` move a column to `start`, `pin end` to `end`,
   * and `pin none` takes it out of both. A column an op pins goes after the
   * base pins on its side, even when the base already pinned it there, as
   * TanStack's `column.pin` does.
   */
  columnPinning: { start: string[]; end: string[] }
  /** `setColumnWidth` sets a column's width, clamped to its size limits. */
  columnSizing: Record<string, number>
  /**
   * `setFilter` sets a column's filter, with a `FilterValue`, and
   * `clearFilter` deletes it. Base filters keep their place and value type.
   */
  columnFilters: { id: string; value: unknown }[]
  /** The `setGroupBy` that holds replaces the whole list. */
  grouping: string[]
  /** `setPage` sets `pageIndex`, and `pageSize` when it has a `size`. */
  pagination: { pageIndex: number; pageSize: number }
}

/** A column's developer-set size limits, as in its TanStack column def. */
export interface ColumnSizeLimits {
  readonly minSize?: number | undefined
  readonly maxSize?: number | undefined
}

/** What `compileTableState` compiles, and on top of what. */
export interface CompileTableStateOptions {
  /** The table node's id, or its slot address. */
  readonly table: string
  /** The table's column ids, in their definition order. */
  readonly columns: readonly string[]
  /**
   * The developer's baseline, which the ops apply on top of: their
   * `initialState`, or their own state as captured before Pliant syncs it.
   * Never pass compiled state back in as `base`: an op that is later removed
   * or undone would stay applied. The developer's own later changes (a
   * `setSorting` call) reach the compiler as ops, not through `base`.
   *
   * A slice left out starts from TanStack's default: empty, `columns` for
   * `columnOrder`, and page 0 of 10 rows for `pagination`. A partial
   * `columnOrder` is completed with the rest of `columns`, as TanStack does.
   * Base pins and filters on ids that aren't in `columns` are kept, since
   * TanStack ignores them. `base` is never returned or changed: every slice
   * is a new object, unless it is reused from `previous`.
   */
  readonly base?: Partial<CompiledTableState> | undefined
  /** Size limits by column id, which `setColumnWidth` widths clamp to. */
  readonly sizeLimits?: Readonly<Record<string, ColumnSizeLimits>> | undefined
  /**
   * The state compiled last time. Each slice equal to its previous one is
   * returned as that same object, and when every slice is, so is `previous`
   * itself: TanStack recomputes its row models, and resets pagination, when
   * it gets a new object for unchanged state. Slices are compared as data
   * (deeply, with `compareData`), at a cost proportional to their size. A
   * value that isn't plain data, such as a `Date` in a base filter, is equal
   * only to itself, so its slice is reused only while it is the same object.
   */
  readonly previous?: CompiledTableState | undefined
}

const slices = [
  "sorting",
  "columnVisibility",
  "columnOrder",
  "columnPinning",
  "columnSizing",
  "columnFilters",
  "grouping",
  "pagination",
] as const satisfies readonly (keyof CompiledTableState)[]

function reuse<T>(previous: T | undefined, next: T): T {
  return previous !== undefined && compareData(previous, next) === 0
    ? previous
    : next
}

function clamp(width: number, { minSize, maxSize }: ColumnSizeLimits = {}) {
  return Math.min(Math.max(width, minSize ?? -Infinity), maxSize ?? Infinity)
}

/**
 * Compiles a table node's resolved layers into TanStack Table v9 state, on
 * top of the developer's `base` state. Ops apply per column and per field: a
 * column or field no op decides keeps its base value, and an op that clears
 * something (`setSort` with `[]`, `clearFilter`, `pin none`) clears it in the
 * base too.
 *
 * - Columns are the items of the table's `columns` collection
 *   (`orders-table/columns/notes`). Ops on ids that aren't in `columns` are
 *   ignored, and repeated ids count once.
 * - A data op's `field` is taken as the TanStack column id. A column whose id
 *   differs from its field (a nested `accessorKey` such as `customer.name`
 *   gets the id `customer_name`) can't be sorted, filtered or grouped by
 *   ops: those fields are left out. A `setSort` or `setGroupBy` whose fields
 *   are all left out still replaces the base list, so it clears it.
 * - `columnOrder` starts from the base order and applies placements as
 *   `orderItems` does. Anchors resolve against every column, hidden ones
 *   included. A column anchored on a pinned one sits next to the pin
 *   boundary on the centre side, since TanStack renders pinned columns
 *   apart. A `sticky` column keeps its place in `columnOrder` but is pinned
 *   to the start, since TanStack pinning is what keeps a column in view.
 * - Columns an op pins follow the base pins, in base order (`start` pins,
 *   then `sticky` ones).
 * - Widths clamp to `sizeLimits`. TanStack also clamps rendered sizes to its
 *   default `minSize` of 20, so a width below that renders at 20 unless the
 *   column sets a lower `minSize`.
 */
export function compileTableState(
  { properties, placements }: Pick<ResolvedLayers, "properties" | "placements">,
  {
    table,
    columns,
    base = {},
    sizeLimits = {},
    previous,
  }: CompileTableStateOptions
): CompiledTableState {
  const node = identityOf(table)
  const ids = [...new Set(columns)]
  const known = new Set(ids)
  const tableOp = (property: "sort" | "groupBy" | "page") =>
    properties.get(node)?.get(property)?.winner.check.op

  const sortOp = tableOp("sort")
  const sorting =
    sortOp?.op === "setSort"
      ? sortOp.sort
          .filter(({ field }) => known.has(field))
          .map(({ field, dir }) => ({ id: field, desc: dir === "desc" }))
      : (base.sorting ?? []).map((sort) => ({ ...sort }))

  const groupOp = tableOp("groupBy")
  const grouping =
    groupOp?.op === "setGroupBy"
      ? groupOp.fields.filter((field) => known.has(field))
      : [...(base.grouping ?? [])]

  const pageOp = tableOp("page")
  const basePage = base.pagination ?? { pageIndex: 0, pageSize: 10 }
  const pagination =
    pageOp?.op === "setPage"
      ? { pageIndex: pageOp.index, pageSize: pageOp.size ?? basePage.pageSize }
      : { ...basePage }

  const columnVisibility = { ...base.columnVisibility }
  const columnSizing = { ...base.columnSizing }
  const filters = new Map(
    base.columnFilters?.map(({ id, value }) => [id, value])
  )
  for (const column of ids) {
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
    const filterOp = properties.get(node)?.get(`filter.${column}`)?.winner
      .check.op
    if (filterOp?.op === "setFilter") {
      const { field, ...value } = filterOp.filter
      filters.set(field, value)
    } else if (filterOp?.op === "clearFilter") {
      filters.delete(column)
    }
  }
  const columnFilters = Array.from(filters, ([id, value]) => ({ id, value }))

  const positions = columnPositions(placements, node, ids)
  const { columnOrder, columnPinning } = layoutColumns(ids, base, (column) =>
    positions.get(column)
  )

  const next: CompiledTableState = {
    sorting: reuse(previous?.sorting, sorting),
    columnVisibility: reuse(previous?.columnVisibility, columnVisibility),
    columnOrder: reuse(previous?.columnOrder, columnOrder),
    columnPinning: reuse(previous?.columnPinning, columnPinning),
    columnSizing: reuse(previous?.columnSizing, columnSizing),
    columnFilters: reuse(previous?.columnFilters, columnFilters),
    grouping: reuse(previous?.grouping, grouping),
    pagination: reuse(previous?.pagination, pagination),
  }
  return previous && slices.every((slice) => previous[slice] === next[slice])
    ? previous
    : next
}
