import { filterSchema, type Op } from "@pliantui/contract"

import { compareData } from "./compare-data"
import {
  compileTableState,
  type CompiledTableState,
  type CompileTableStateOptions,
} from "./compile-table-state"
import { identityOf } from "./node-identity"
import type { ResolvedLayers } from "./resolve-layers"
import { columnPositions, layoutColumns } from "./table-columns"

type Reorder =
  | { readonly before: string }
  | { readonly after: string }
  | { readonly index: number }

// TanStack's default column size.
const defaultSize = 150

/** What `diffTableState` compares, and how it compiles. */
export interface DiffTableStateOptions extends CompileTableStateOptions {
  /**
   * The width each column renders at without a `columnSizing` entry: its
   * column def's `size`, or TanStack's 150 when left out. A width reset to it
   * is saved as that width, since no op unsets one.
   */
  readonly defaultSizes?: Readonly<Record<string, number>> | undefined
}

/** The ops a state change makes, and what it couldn't make ops of. */
export interface TableStateDiff {
  /** The ops, in a stable order: table ops first, then columns in order. */
  readonly ops: Op[]
  /**
   * Columns whose new filter value isn't a `FilterValue`, such as a raw
   * value the developer's own filter UI set. No op is made for them; the
   * caller maps the value to a `FilterValue` first, or keeps it elsewhere.
   */
  readonly unmapped: string[]
}

type Side = "start" | "end" | "none"

function sideOf(pinning: CompiledTableState["columnPinning"], column: string) {
  return pinning.start.includes(column)
    ? "start"
    : pinning.end.includes(column)
      ? "end"
      : "none"
}

function filterOf(field: string, value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? filterSchema.safeParse({ ...value, field }).data
    : undefined
}

function unique(ids: readonly string[], known: ReadonlySet<string>) {
  return [...new Set(ids)].filter((id) => known.has(id))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// The items of `current` that already sit in `target`'s order: a longest
// increasing subsequence of their places in `target`.
function inOrder(current: readonly string[], target: readonly string[]) {
  const place = new Map(target.map((item, index) => [item, index]))
  const tails: number[] = []
  const previous: number[] = []
  current.forEach((item, index) => {
    const value = place.get(item) ?? -1
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      const tail = tails[middle] ?? 0
      if ((place.get(current[tail] ?? "") ?? -1) < value) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1
    tails[low] = index
  })
  const kept = new Set<string>()
  for (
    let index = tails.at(-1) ?? -1;
    index >= 0;
    index = previous[index] ?? -1
  ) {
    kept.add(current[index] ?? "")
  }
  return kept
}

function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

/**
 * The ops that change a table's compiled state into `next`, the inverse of
 * `compileTableState`: applied as one overlay above the resolved layers,
 * they compile into `next`. Only what differs from the current compiled
 * state becomes an op, so a click saves one property, never a copy of the
 * whole state. Slices left out of `next` are unchanged.
 *
 * - `sorting` and `grouping` become `setSort` and `setGroupBy`, which
 *   replace the whole list, and `pagination` becomes `setPage`, with `size`
 *   only when it differs from the base page size. Ids that aren't in
 *   `columns` are left out, and lists are cut to the contract's limits (8
 *   sorts, 4 groups, pages of 1000 rows).
 * - `columnVisibility` becomes `hide` or `show` per changed column; a column
 *   without an entry is visible.
 * - `columnSizing` becomes `setColumnWidth` per changed column, rounded and
 *   clamped to the contract's 16–2000 and the column's `sizeLimits`. A
 *   column without an entry has its `defaultSizes` width.
 * - `columnFilters` becomes `setFilter` per new or changed `FilterValue`, and
 *   `clearFilter` per removed filter. Other values are listed in `unmapped`.
 * - `columnPinning` becomes `pin` per column that changes side. The order
 *   within a side is the canonical one `compileTableState` gives, so it isn't
 *   compared. `columnOrder` becomes the fewest `move`s that put the unpinned
 *   columns in `next`'s order, anchored on their neighbours. Since `pin` and
 *   `move` set the same placement, a move also unpins a column pinned by an
 *   op. A column the base pins and `next` unpins keeps its place: moving it
 *   would pin it again.
 */
export function diffTableState(
  resolved: Pick<ResolvedLayers, "properties" | "placements">,
  next: Partial<CompiledTableState>,
  options: DiffTableStateOptions
): TableStateDiff {
  const { table, base = {}, sizeLimits = {}, defaultSizes = {} } = options
  const previous = compileTableState(resolved, options)
  const ids = [...new Set(options.columns)]
  const known = new Set(ids)
  const target = (column: string) => `${table}/columns/${column}`
  const changed = <K extends keyof CompiledTableState>(slice: K) => {
    const value = next[slice]
    return value !== undefined && compareData(previous[slice], value) !== 0
      ? value
      : undefined
  }
  const ops: Op[] = []
  const unmapped: string[] = []

  const sorting = changed("sorting")
  if (sorting) {
    ops.push({
      op: "setSort",
      target: table,
      sort: unique(
        sorting.map(({ id }) => id),
        known
      )
        .slice(0, 8)
        .map((id) => ({
          field: id,
          dir: sorting.find((sort) => sort.id === id)?.desc ? "desc" : "asc",
        })),
    })
  }

  const filters = changed("columnFilters")
  if (filters) {
    const before = new Map(
      previous.columnFilters.map(({ id, value }) => [id, value])
    )
    const after = new Map(filters.map(({ id, value }) => [id, value]))
    for (const [id, value] of after) {
      if (!known.has(id) || compareData(before.get(id), value) === 0) {
        continue
      }
      const filter = filterOf(id, value)
      if (filter) {
        ops.push({ op: "setFilter", target: table, filter })
      } else {
        unmapped.push(id)
      }
    }
    for (const id of before.keys()) {
      if (known.has(id) && !after.has(id)) {
        ops.push({ op: "clearFilter", target: table, field: id })
      }
    }
  }

  const grouping = changed("grouping")
  if (grouping) {
    ops.push({
      op: "setGroupBy",
      target: table,
      fields: unique(grouping, known).slice(0, 4),
    })
  }

  const pagination = changed("pagination")
  if (pagination) {
    const size = clamp(Math.round(pagination.pageSize), 1, 1000)
    ops.push({
      op: "setPage",
      target: table,
      index: Math.max(0, Math.trunc(pagination.pageIndex)),
      ...(size !== (base.pagination?.pageSize ?? 10) && { size }),
    })
  }

  const placed = placementOps(resolved, next, previous, options)
  const visibility = changed("columnVisibility")
  const sizing = changed("columnSizing")
  for (const column of ids) {
    const placement = placed.get(column)
    if (placement) {
      ops.push(placement)
    }
    if (
      visibility &&
      (previous.columnVisibility[column] !== false) !==
        (visibility[column] !== false)
    ) {
      ops.push({
        op: visibility[column] === false ? "hide" : "show",
        target: target(column),
      })
    }
    const fallback = defaultSizes[column] ?? defaultSize
    const before = previous.columnSizing[column] ?? fallback
    const after = sizing?.[column] ?? fallback
    const { minSize = 16, maxSize = 2000 } = sizeLimits[column] ?? {}
    const width = clamp(
      clamp(Math.round(after), 16, 2000),
      Math.max(minSize, 16),
      Math.min(maxSize, 2000)
    )
    if (sizing && after !== before && width !== before) {
      ops.push({ op: "setColumnWidth", target: target(column), width })
    }
  }
  return { ops, unmapped }
}

function placementOps(
  { placements }: Pick<ResolvedLayers, "placements">,
  next: Partial<CompiledTableState>,
  previous: CompiledTableState,
  { table, columns, base = {} }: CompileTableStateOptions
) {
  const ops = new Map<string, Op>()
  if (next.columnOrder === undefined && next.columnPinning === undefined) {
    return ops
  }
  const ids = [...new Set(columns)]
  const known = new Set(ids)
  const target = (column: string) => `${table}/columns/${column}`
  const positions = columnPositions(placements, identityOf(table), ids)
  const pinning = next.columnPinning ?? previous.columnPinning

  for (const column of ids) {
    const side: Side = sideOf(pinning, column)
    if (sideOf(previous.columnPinning, column) !== side) {
      positions.set(column, { pin: side })
      ops.set(column, { op: "pin", target: target(column), where: side })
    }
  }

  if (
    next.columnOrder === undefined ||
    compareData(next.columnOrder, previous.columnOrder) === 0
  ) {
    return ops
  }
  const center = new Set(ids.filter((id) => sideOf(pinning, id) === "none"))
  const wanted = unique([...next.columnOrder, ...ids], known).filter((id) =>
    center.has(id)
  )
  const basePinned = new Set([
    ...(base.columnPinning?.start ?? []),
    ...(base.columnPinning?.end ?? []),
  ])
  const orderOf = (moves: ReadonlyMap<string, Reorder>) =>
    layoutColumns(
      ids,
      base,
      (column) => moves.get(column) ?? positions.get(column)
    ).columnOrder.filter((id) => center.has(id))

  const current = orderOf(new Map())
  if (sameOrder(current, wanted)) {
    return ops
  }
  const kept = inOrder(current, wanted)
  const movable = (column: string) =>
    !kept.has(column) && !basePinned.has(column)
  // Anchoring on the previous column fails when another column is already
  // anchored after it, and sorts first; the next column's `before` side
  // may be free. Moving every column always works.
  const anchored = (forward: boolean) => {
    const order = forward ? wanted : wanted.toReversed()
    const end = order.find((column) => !movable(column))
    const moves = new Map<string, Reorder>()
    order.forEach((column, index) => {
      const neighbour = order[index - 1]
      if (movable(column)) {
        moves.set(
          column,
          neighbour !== undefined
            ? forward
              ? { after: neighbour }
              : { before: neighbour }
            : end !== undefined
              ? forward
                ? { before: end }
                : { after: end }
              : { index: 0 }
        )
      }
    })
    return moves
  }
  const chain = wanted.filter((column) => !basePinned.has(column))
  const moves =
    [anchored(true), anchored(false)].find((candidate) =>
      sameOrder(orderOf(candidate), wanted)
    ) ??
    new Map(
      chain.map((column, index) => {
        const before = chain[index - 1]
        const to: Reorder =
          before === undefined ? { index: 0 } : { after: before }
        return [column, to]
      })
    )
  for (const [column, to] of moves) {
    ops.set(column, { op: "move", target: target(column), to })
  }
  return ops
}
