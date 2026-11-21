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

import { itemIdSchema, type Op } from "@pliantui/contract"
import {
  diffTableState,
  type CompiledTableState,
  type CompileTableStateOptions,
} from "@pliantui/core"

import {
  isLocalSlice,
  splitLocal,
  withLocal,
  type LocalColumns,
} from "./local-columns"
import { useLayerStore } from "./pliant-context"
import { pliantFilterFn } from "./pliant-filter-fns"
import { withPliantFeatures } from "./pliant-table-features"
import { propertiesOf } from "./property-keys"
import { isSameState } from "./same-state"
import {
  acceptedAggregates,
  aggregateColumns,
  aggregatesOf,
  type PliantTableDataset,
  type TableAggregate,
} from "./table-aggregates"
import { createDerived, createTableCache } from "./table-cache"
import { tableColumnsOf, type TableColumn } from "./table-columns"
import { filtersToSave, presentFilters, type RawFilter } from "./table-filters"
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
  /**
   * The dataset's fields and time zone, which aggregates (`addAggregate`
   * ops) are computed against: a `defineDataset` result works. Without it,
   * a table shows no aggregates. Define it outside the component, or keep
   * it equal as data between renders.
   */
  readonly dataset?: PliantTableDataset | undefined
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
   * A table with `manualSorting` can wait for it before fetching. It isn't
   * enumerable, so it stays out of the table's own options.
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

interface CompileSetup {
  readonly compileOptions: Omit<CompileTableStateOptions, "previous"> & {
    readonly columns: string[]
    readonly defaultSizes: Record<string, number>
  }
  readonly key: string
}

function compileSetupOf(
  table: string,
  columns: readonly Pick<TableColumn, "id" | "limits" | "size">[],
  base: Partial<CompiledTableState>
): CompileSetup {
  const compileOptions = {
    table,
    columns: columns.map((column) => column.id),
    base,
    sizeLimits: Object.fromEntries(
      columns.map((column) => [column.id, column.limits])
    ),
    defaultSizes: Object.fromEntries(
      columns.map((column) => [column.id, column.size])
    ),
  }
  return {
    compileOptions,
    key: JSON.stringify([
      table,
      compileOptions.columns,
      compileOptions.sizeLimits,
      compileOptions.defaultSizes,
    ]),
  }
}

// How many renders in a row may sync the developer's state.
const maxSyncs = 25

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

function same(a: unknown, b: unknown) {
  return isSameState(a, b)
}

function warnInDevelopment(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message)
  }
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
 * Makes a TanStack Table v9 table editable by Pliant: wraps the options
 * passed to `useTable`, as
 * `useTable(usePliantTable({ features, data, columns }, { id: "orders-table" }))`.
 *
 * The table's state comes from the surface's resolved layers, compiled with
 * core's `compileTableState` on top of the developer's `initialState` and
 * the state they control, as captured on the first render: later changes
 * to `initialState` are ignored, as TanStack ignores them. Every change
 * TanStack reports (a header click, a drag, the developer's own `setX`
 * calls) becomes the ops core's `diffTableState` makes: sorting, visibility,
 * widths, order, pinning and grouping save to the personal layer, and
 * pagination and filters to the session layer (filters too with
 * `persistFilters`). While an AI preview writes a property, a change to it
 * goes to the session layer, above the preview, so it shows. Slices that
 * didn't change keep their objects, so TanStack recomputes row models only
 * when an op changes their state.
 *
 * - Each `addAggregate` op adds a column with its id, label and a `meta`
 *   of `{ label, pliant: { type, unit } }`, the type and unit of its
 *   values. It has no value on a data row. A group's row, and
 *   `column.getAggregationValue()` for the filtered rows as a whole, hold
 *   it, computed over those rows in the table's sort order, with ties
 *   and an unsorted table in ascending order of the row key (`getRowId`, else
 *   the field named `id`), which `first` and `last` read. Aggregates need the `dataset` option, and an
 *   aggregate that can't be computed, or whose id a column already has, is
 *   reported to `onError` and left out. Ops hide, move and pin it like any
 *   column.
 * - Rows expand with `row.toggleExpanded()`, since a group's rows show only
 *   once it does.
 * - The table node and its columns (`<id>/columns/<column id>`) are
 *   registered as mounted.
 * - The features its ops need are added when the table is created, since
 *   TanStack reads `features` once; see `withPliantFeatures`.
 * - Columns without their own `filterFn` filter with Pliant's, which reads
 *   each `FilterValue` (see `matchesFilter`), or a raw value from the
 *   developer's filter UI, guessed as `rawFilterValueOf` documents: text
 *   is `contains`, a pair of numbers is a range, and a list is `in`. The
 *   table is shown the raw value back.
 * - A column with its own `filterFn` gets the bare value of `custom`
 *   filters, when it declares their schema in `meta.pliant.filterValue` (a
 *   Standard Schema, such as a Zod schema). It can't read other operators:
 *   those filters are left out of the table and reported to `onError`.
 * - Raw values that map to no filter, such as any value on a column with
 *   its own `filterFn` and no schema, and the state of columns whose ids
 *   aren't valid item ids (letters, digits, `-` and `_`, starting with a
 *   letter), stay in the table only: they aren't saved, and are gone after
 *   a reload.
 * - State the developer controls (with `state` and `on<Slice>Change`) is
 *   kept in sync, compared as data, so state rebuilt on every render is
 *   fine: their callback is called with each new value, one render after
 *   the table gets it, and their own changes to it become ops.
 *
 * @experimental
 */
export function usePliantTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(
  options: TableOptions<TFeatures, TData>,
  { id, persistFilters = false, dataset }: UsePliantTableOptions
): PliantTableOptions<TFeatures, TData> {
  const store = useLayerStore("usePliantTable")
  const ready = usePliantStatus().status === "ready"
  const [base] = useState(() => baseOf(options))
  const [cache] = useState(() => ({
    table: createTableCache(),
    filters: createDerived<ReturnType<typeof presentFilters>>(),
    shown: createDerived<CompiledTableState>(),
    aggregates: createDerived<TableAggregate[]>(),
    accepted: createDerived<ReturnType<typeof acceptedAggregates>>(),
    built: createDerived<readonly unknown[]>(),
    dataset: createDerived<PliantTableDataset | undefined>(),
  }))
  const [rawFilters, setRawFilters] = useState<ReadonlyMap<string, RawFilter>>(
    () => new Map()
  )
  const [local, setLocal] = useState<LocalColumns>({})
  const sync = useRef<{
    sent: Partial<Record<Slice, unknown>>
    seen: Partial<Record<Slice, unknown>>
    warned: Set<string>
    reported: WeakSet<object>
    syncs: number
  }>({
    sent: {},
    seen: { ...base },
    warned: new Set(),
    reported: new WeakSet(),
    syncs: 0,
  })

  const allColumns = tableColumnsOf(options.columns, options.defaultColumn)
  const invalid = allColumns
    .filter((column) => !itemIdSchema.safeParse(column.id).success)
    .map((column) => column.id)
  const isLocal = (column: string) => invalid.includes(column)
  const columns = allColumns.filter((column) => !isLocal(column.id))
  const columnOf = (column: string) =>
    allColumns.find((other) => other.id === column)

  // Aggregates are columns of the table too, so they share its id space: an
  // aggregate whose id a column already has isn't added.
  const columnIds = allColumns.map((column) => column.id).join("\n")
  const stableDataset = cache.dataset([dataset], () => dataset)
  const acceptedAt = (resolved: Parameters<typeof cache.table.compile>[0]) => {
    const aggregates = cache.aggregates([resolved], () =>
      aggregatesOf(resolved, id)
    )
    return cache.accepted([aggregates, stableDataset, columnIds], () =>
      acceptedAggregates(
        aggregates,
        stableDataset,
        new Set(columnIds.split("\n"))
      )
    )
  }
  const setupAt = (resolved: Parameters<typeof cache.table.compile>[0]) =>
    compileSetupOf(
      id,
      [
        ...columns,
        ...acceptedAt(resolved).accepted.map(({ id }) => ({
          id,
          size: 150,
          limits: {},
        })),
      ],
      base
    )
  const { accepted, issues } = useSyncExternalStore(
    store.subscribe,
    () => acceptedAt(store.getResolved()),
    () => acceptedAt(store.getServerResolved())
  )
  const ownFilters = JSON.stringify(
    allColumns.map((column) => [
      column.id,
      column.ownFilter,
      column.filterValue !== undefined,
    ])
  )

  const mounted = [
    id,
    ...[...columns, ...accepted].map((column) => `${id}/columns/${column.id}`),
  ].join("\n")
  useLayoutEffect(
    () => store.registerNodes(mounted.split("\n")),
    [store, mounted]
  )

  const compile = (resolved: Parameters<typeof cache.table.compile>[0]) => {
    const setup = setupAt(resolved)
    return cache.table.compile(resolved, setup.compileOptions, setup.key)
  }
  const compiled = useSyncExternalStore(
    store.subscribe,
    () => compile(store.getResolved()),
    () => compile(store.getServerResolved())
  )
  const filtersOf = (state: CompiledTableState) =>
    cache.filters([state.columnFilters, rawFilters, ownFilters], () =>
      presentFilters(state.columnFilters, rawFilters, columnOf)
    )
  const shownOf = (state: CompiledTableState) =>
    cache.shown([state, local, filtersOf(state).shown], () => ({
      ...withLocal(state, local),
      columnFilters: filtersOf(state).shown,
    }))
  const shown = shownOf(compiled)

  // TanStack computes an aggregate by its rows, so a group's `first` and
  // `last` would keep the order of the sort they were computed under. New
  // columns when the sort changes make it compute them again; aggregates
  // that don't read the order keep their columns.
  const built = cache.built(
    [
      accepted,
      options.columns,
      accepted.some(({ ordered }) => ordered) ? shown.sorting : undefined,
    ],
    () => aggregateColumns(accepted, options.columns)
  )

  // While a preview writes a property, a personal change to it would stay
  // hidden under the preview, so it goes to the session layer above it.
  function layersOf(slice: Slice, ops: readonly Op[]) {
    const layer =
      slice === "pagination" || (slice === "columnFilters" && !persistFilters)
        ? "session"
        : "personal"
    const previewed = new Set(
      store
        .getPreview()
        ?.ops.flatMap((check) =>
          check.status === "valid" ? propertiesOf(check.op) : []
        )
    )
    const session = ops.filter(
      (op) =>
        layer === "session" ||
        propertiesOf(op).some((property) => previewed.has(property))
    )
    return [
      ["personal", ops.filter((op) => !session.includes(op))],
      ["session", session],
    ] as const
  }

  function commit(slice: Slice, value: unknown) {
    const resolved = store.getResolved()
    const previous = compile(resolved)
    let saved = value
    if (slice === "columnFilters") {
      const { filters, raws } = filtersToSave(
        previous.columnFilters,
        filtersOf(previous).shown,
        value,
        rawFilters,
        columnOf,
        isLocal
      )
      saved = filters
      setRawFilters((current) =>
        isSameState([...current], [...raws]) ? current : raws
      )
    } else if (invalid.length > 0 && isLocalSlice(slice)) {
      const split = splitLocal(slice, value, isLocal)
      saved = split.saved
      setLocal((current) => ({ ...current, ...split.kept }))
    }
    const { ops } = diffTableState(
      resolved,
      { [slice]: saved },
      { ...setupAt(resolved).compileOptions, previous }
    )
    for (const [layer, layerOps] of layersOf(slice, ops)) {
      if (layerOps.length > 0) {
        const result = store.actions.applyOps(layer, layerOps)
        if (!result.success) {
          store.report(new Error(result.error))
        }
      }
    }
  }

  function change(slice: Slice, updater: Updater<unknown>) {
    sync.current.syncs = 0
    const current = () => shownOf(compile(store.getResolved()))[slice]
    commit(slice, functionalUpdate(updater, current()))
    const callback = callbackOf(options, slice)
    if (callback) {
      const value = current()
      sync.current.sent[slice] = value
      callback(value)
    }
  }

  useLayoutEffect(() => {
    const { warned, reported } = sync.current
    for (const column of invalid) {
      if (!warned.has(column)) {
        warned.add(column)
        warnInDevelopment(
          `Pliant: column "${column}" of ${id} has an id ops can't name (letters, digits, - and _, starting with a letter), so its state isn't saved.`
        )
      }
    }
    for (const issue of issues) {
      const text = `Pliant: ${id} has no aggregate ${issue}`
      if (!warned.has(text)) {
        warned.add(text)
        store.report(new Error(text))
      }
    }
    // Validation can't reject these: it doesn't know which columns have
    // their own filterFn.
    for (const filter of filtersOf(compiled).dropped) {
      if (typeof filter.value === "object" && filter.value !== null) {
        if (reported.has(filter.value)) {
          continue
        }
        reported.add(filter.value)
      }
      const message = `Pliant: the filter on column "${filter.id}" of ${id} isn't applied: the column has its own filterFn, which reads only "custom" filters with a meta.pliant.filterValue schema.`
      store.report(new Error(message))
      warnInDevelopment(message)
    }
  })

  // State that differs on every render (a new sort each time, say) would
  // sync forever, so syncing stops after many syncs in a row in one task,
  // until the next task.
  useLayoutEffect(() => {
    const developerState = read(options, "state")
    const { sent, seen } = sync.current
    if (sync.current.syncs > maxSyncs) {
      return
    }
    let synced = false
    for (const slice of slices) {
      const theirs = read(developerState, slice)
      if (theirs === undefined) {
        continue
      }
      if (!same(theirs, seen[slice])) {
        seen[slice] = theirs
        if (!same(theirs, sent[slice])) {
          synced = true
          commit(slice, theirs)
          continue
        }
      }
      const ours = shown[slice]
      const callback = callbackOf(options, slice)
      if (callback && !same(ours, sent[slice]) && !same(ours, theirs)) {
        synced = true
        sent[slice] = ours
        callback(ours)
      }
    }
    sync.current.syncs = synced ? sync.current.syncs + 1 : 0
    if (synced) {
      // A loop re-renders synchronously, within one task, so this runs only
      // once it has ended: syncs spread over time never add up.
      const current = sync.current
      queueMicrotask(() => {
        current.syncs = 0
      })
    }
    if (sync.current.syncs > maxSyncs) {
      warnInDevelopment(
        `Pliant: the state passed to ${id} changes on every render, so Pliant stopped syncing it. Pass state that changes only when the table's does.`
      )
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
  const tableOptions = Object.assign({}, options, handlers, {
    features,
    columns: built,
    defaultColumn,
    state: { ...objectOf(read(options, "state")), ...shown },
  })
  // `defineProperty` doesn't add the property it defines to the type.
  return Object.defineProperty(tableOptions, "ready", {
    value: ready,
    enumerable: false,
  }) as typeof tableOptions & { readonly ready: boolean }
}
