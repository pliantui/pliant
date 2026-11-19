import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  functionalUpdate,
  type RowData,
  type TableFeatures,
  type TableOptions,
  type Updater,
} from "@tanstack/react-table"

import {
  diffTableState,
  type CompiledTableState,
  type FilterValue,
} from "@pliantui/core"

import { useLayerStore } from "./pliant-context"
import {
  filterValueOf,
  pliantFilterFn,
  rawFilterValueOf,
} from "./pliant-filter-fns"
import { withPliantFeatures } from "./pliant-table-features"
import { createTableCache, type ColumnFilter } from "./table-cache"
import {
  customValueOf,
  tableColumnsOf,
  type TableColumn,
} from "./table-columns"
import { usePliantStatus } from "./use-pliant-status"

/** @experimental */
export interface UsePliantTableOptions {
  /** The table node's id, such as `orders-table`, or its slot address. */
  readonly id: string
  /**
   * Whether filter changes save to the personal layer, like sorting does.
   * By default they stay in the session layer, as pagination does.
   */
  readonly persistFilters?: boolean | undefined
}

/**
 * TanStack Table options with Pliant's state, handlers and features, and
 * whether the surface's layers have loaded.
 *
 * @experimental
 */
export type PliantTableOptions<
  TFeatures extends TableFeatures,
  TData extends RowData,
> = TableOptions<TFeatures, TData> & {
  /**
   * Whether the layers have loaded (see `usePliantStatus`). Until then the
   * table shows the developer's base state, and changes to it are rejected.
   * A table with `manualSorting` can wait for it before fetching.
   */
  readonly ready: boolean
}

type Slice = keyof CompiledTableState

const callbacks = {
  sorting: "onSortingChange",
  columnVisibility: "onColumnVisibilityChange",
  columnOrder: "onColumnOrderChange",
  columnPinning: "onColumnPinningChange",
  columnSizing: "onColumnSizingChange",
  columnFilters: "onColumnFiltersChange",
  grouping: "onGroupingChange",
  pagination: "onPaginationChange",
} as const satisfies Record<Slice, string>

const slices: readonly Slice[] = [
  "sorting",
  "columnVisibility",
  "columnOrder",
  "columnPinning",
  "columnSizing",
  "columnFilters",
  "grouping",
  "pagination",
]

// A value the developer's filter UI set, and the filter it maps to, if any.
interface RawFilter {
  readonly entry: ColumnFilter
  readonly value: FilterValue | undefined
}

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

function callbackOf(options: object, slice: Slice) {
  const callback = read(options, callbacks[slice])
  return typeof callback === "function"
    ? (value: unknown) => {
        Reflect.apply(callback, undefined, [value])
      }
    : undefined
}

function objectOf(value: unknown): object {
  return typeof value === "object" && value !== null ? value : {}
}

function sameValue(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

// The developer's baseline: their `initialState`, with the state they
// control on top, as it was before Pliant changed it.
function baseOf(options: object): Partial<CompiledTableState> {
  const initialState = read(options, "initialState")
  const state = read(options, "state")
  return Object.fromEntries(
    slices.flatMap((slice) => {
      const value = read(state, slice) ?? read(initialState, slice)
      return value === undefined ? [] : [[slice, value]]
    })
  )
}

/**
 * The raw value to show TanStack for a filter Pliant holds: the developer's
 * own value when it maps to the filter, the bare value of a `custom` filter
 * for a column with its own `filterFn`, or `undefined` for a filter that
 * column can't read.
 */
function presentFilter(
  column: TableColumn | undefined,
  value: unknown,
  raw: RawFilter | undefined
) {
  if (raw?.value && sameValue(raw.value, value)) {
    return { value: raw.entry.value }
  }
  const filter = filterValueOf(value)
  if (!column?.ownFilter || !filter) {
    return { value }
  }
  return filter.operator === "custom" ? { value: filter.value } : undefined
}

/**
 * Makes a TanStack Table v9 table editable by Pliant: wraps the options
 * passed to `useTable`, as
 * `useTable(usePliantTable({ features, data, columns }, { id: "orders-table" }))`.
 *
 * The table's state comes from the surface's resolved layers, compiled with
 * core's `compileTableState` on top of the developer's `initialState` and
 * the state they control, as captured on the first render. Every change
 * TanStack reports (a header click, a drag, the developer's own `setX`
 * calls) becomes the ops core's `diffTableState` makes: sorting, visibility,
 * widths, order, pinning and grouping save to the personal layer, and
 * pagination and filters to the session layer (filters too with
 * `persistFilters`). Slices that didn't change keep their objects, so
 * TanStack recomputes row models only when an op changes their state.
 *
 * - The table node and its columns (`<id>/columns/<column id>`) are
 *   registered as mounted.
 * - The features its ops need are added when the table is created, since
 *   TanStack reads `features` once; see `withPliantFeatures`.
 * - Columns without their own `filterFn` filter with Pliant's, which reads
 *   each `FilterValue` operator, or a raw value from the developer's filter
 *   UI as text `contains`, a number or boolean `eq`, two numbers `between`
 *   and a list `in`. A column with its own `filterFn` gets the raw value of
 *   `custom` filters, when it declares their schema in
 *   `meta.pliant.filterValue` (a Standard Schema, such as a Zod schema). Raw
 *   values that map to no filter, such as any value on a column with its
 *   own `filterFn` and no schema, stay in this component until it unmounts.
 * - State the developer controls (with `state` and `on<Slice>Change`) is
 *   kept in sync: their callback is called with each new value, one render
 *   after the table gets it, and their own changes to it become ops.
 *
 * @experimental
 */
export function usePliantTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  options: TableOptions<TFeatures, TData>,
  { id, persistFilters = false }: UsePliantTableOptions
): PliantTableOptions<TFeatures, TData> {
  const store = useLayerStore("usePliantTable")
  const ready = usePliantStatus().status === "ready"
  const [base] = useState(() => baseOf(options))
  const [cache] = useState(createTableCache)
  const [rawFilters, setRawFilters] = useState<ReadonlyMap<string, RawFilter>>(
    () => new Map()
  )
  const sync = useRef<{
    sent: Partial<Record<Slice, unknown>>
    seen: Partial<Record<Slice, unknown>>
  }>({ sent: {}, seen: { ...base } })

  const columns = tableColumnsOf(options.columns, options.defaultColumn)
  const byId = new Map(columns.map((column) => [column.id, column]))
  const compileOptions = {
    table: id,
    columns: columns.map((column) => column.id),
    base,
    sizeLimits: Object.fromEntries(
      columns.map((column) => [column.id, column.limits])
    ),
    defaultSizes: Object.fromEntries(
      columns.map((column) => [column.id, column.size])
    ),
  }
  const key = JSON.stringify([
    id,
    compileOptions.columns,
    compileOptions.sizeLimits,
  ])

  const mounted = [
    id,
    ...columns.map((column) => `${id}/columns/${column.id}`),
  ].join("\n")
  useLayoutEffect(
    () => store.registerNodes(mounted.split("\n")),
    [store, mounted]
  )

  const compile = (resolved: Parameters<typeof cache.compile>[0]) =>
    cache.compile(resolved, compileOptions, key)
  const compiled = useSyncExternalStore(
    store.subscribe,
    () => compile(store.getResolved()),
    () => compile(store.getServerResolved())
  )
  const present = (filters: readonly ColumnFilter[]) =>
    cache.present(
      filters,
      rawFilters,
      (filter) =>
        presentFilter(
          byId.get(filter.id),
          filter.value,
          rawFilters.get(filter.id)
        ),
      () =>
        [...rawFilters.values()].flatMap(({ entry, value }) =>
          value === undefined &&
          !filters.some((filter) => filter.id === entry.id)
            ? [entry]
            : []
        )
    )
  const shown = { ...compiled, columnFilters: present(compiled.columnFilters) }

  const layerOf = (slice: Slice) =>
    slice === "pagination" || (slice === "columnFilters" && !persistFilters)
      ? "session"
      : "personal"

  function commit(slice: Slice, value: unknown) {
    const resolved = store.getResolved()
    const previous = compile(resolved)
    const next =
      slice === "columnFilters"
        ? filtersToCommit(previous, value)
        : { [slice]: value }
    const { ops } = diffTableState(resolved, next, {
      ...compileOptions,
      previous,
    })
    if (ops.length > 0) {
      const result = store.actions.applyOps(layerOf(slice), ops)
      if (!result.success) {
        store.report(new Error(result.error))
      }
    }
  }

  // Maps the filters TanStack reports to the ones Pliant holds: unchanged
  // entries keep Pliant's value, and changed raw values become filters
  // when they map to one, or stay here when they don't.
  function filtersToCommit(previous: CompiledTableState, value: unknown) {
    const before = new Map(
      present(previous.columnFilters).map((filter) => [filter.id, filter.value])
    )
    const held = new Map(
      previous.columnFilters.map((filter) => [filter.id, filter.value])
    )
    const next: ColumnFilter[] = []
    const raws = new Map<string, RawFilter>()
    for (const filter of Array.isArray(value) ? value : []) {
      const filterId = read(filter, "id")
      const raw = read(filter, "value")
      if (typeof filterId !== "string") {
        continue
      }
      if (before.has(filterId) && sameValue(before.get(filterId), raw)) {
        if (held.has(filterId)) {
          next.push({ id: filterId, value: held.get(filterId) })
        }
        const kept = rawFilters.get(filterId)
        if (kept) {
          raws.set(filterId, kept)
        }
        continue
      }
      const column = byId.get(filterId)
      const custom = column?.ownFilter ? customValueOf(column, raw) : undefined
      const mapped = column?.ownFilter
        ? (filterValueOf(raw) ??
          (custom &&
            filterValueOf({ operator: "custom", value: custom.value })))
        : rawFilterValueOf(raw)
      if (mapped) {
        next.push({ id: filterId, value: mapped })
      }
      raws.set(filterId, { entry: { id: filterId, value: raw }, value: mapped })
    }
    for (const [filterId, filterValue] of held) {
      if (!before.has(filterId) && !next.some((item) => item.id === filterId)) {
        next.push({ id: filterId, value: filterValue })
      }
    }
    setRawFilters(raws)
    return { columnFilters: next }
  }

  function shownOf(slice: Slice) {
    const current = compile(store.getResolved())
    return slice === "columnFilters"
      ? present(current.columnFilters)
      : current[slice]
  }

  function change(slice: Slice, updater: Updater<unknown>) {
    commit(slice, functionalUpdate(updater, shownOf(slice)))
    const callback = callbackOf(options, slice)
    if (callback) {
      const value = shownOf(slice)
      sync.current.sent[slice] = value
      callback(value)
    }
  }

  useLayoutEffect(() => {
    const developerState = read(options, "state")
    for (const slice of slices) {
      const theirs = read(developerState, slice)
      if (theirs === undefined) {
        continue
      }
      const { sent, seen } = sync.current
      if (theirs !== seen[slice]) {
        seen[slice] = theirs
        if (theirs !== sent[slice]) {
          commit(slice, theirs)
          continue
        }
      }
      const ours = shown[slice]
      const callback = callbackOf(options, slice)
      if (callback && ours !== sent[slice] && !sameValue(ours, theirs)) {
        sent[slice] = ours
        callback(ours)
      }
    }
  })

  const features = useMemo(
    () => withPliantFeatures(options.features),
    [options.features]
  )
  const defaultColumn = useMemo(
    () => ({ filterFn: pliantFilterFn, ...options.defaultColumn }),
    [options.defaultColumn]
  )
  const handlers = Object.fromEntries(
    slices.map((slice) => [
      callbacks[slice],
      (updater: Updater<unknown>) => {
        change(slice, updater)
      },
    ])
  )

  // TanStack types the options by the developer's features only, so the
  // features Pliant adds, and their state and handlers, aren't in the type.
  return Object.assign({}, options, handlers, {
    features,
    defaultColumn,
    state: { ...objectOf(read(options, "state")), ...shown },
    ready,
  })
}
