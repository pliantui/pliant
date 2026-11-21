"use client"

import type { ComponentProps, ReactNode } from "react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import { ChevronDown, X } from "lucide-react"

import type { Op } from "@pliantui/contract"
import {
  usePliantMessages,
  usePliantStore,
  useResolved,
  type PliantMessages,
} from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

import {
  PliantDataTableFacetedFilter,
  type PliantDataTableFacet,
} from "./pliant-data-table-faceted-filter"
import type { PliantDataTableFeatures } from "./pliant-data-table-features"
import { PliantDataTableViewOptions } from "./pliant-data-table-view-options"

declare module "@pliantui/react" {
  interface PliantMessages {
    dataTableFilterPlaceholder: (label: string) => string
    dataTableSort: string
    dataTablePresets: string
    dataTableReset: string
  }
}

const toolbarMessages = {
  dataTableFilterPlaceholder: (label) => `Filter ${label.toLowerCase()}…`,
  dataTableSort: "Sort",
  dataTablePresets: "Presets",
  dataTableReset: "Reset",
} satisfies Partial<PliantMessages>

type ItemOp<Name extends Op["op"]> = Omit<
  Extract<Op, { op: Name }>,
  "op" | "target"
>

/**
 * A filter in the toolbar, in the shape of an `addFilterControl` op. Its
 * `id` defaults to its `field`.
 */
type PliantDataTableFilterControl = Omit<ItemOp<"addFilterControl">, "id"> & {
  id?: string
}

/** A way to sort the table, in the shape of an `addSortOption` op. */
type PliantDataTableSortOption = ItemOp<"addSortOption">

/** Filters and a sort to apply at once, in the shape of an `addPreset` op. */
type PliantDataTablePreset = ItemOp<"addPreset">

type TableColumn<TData extends RowData> = Column<PliantDataTableFeatures, TData>

const userItemKinds = [
  "derived",
  "aggregate",
  "highlight",
  "sortOption",
  "filterControl",
  "preset",
]

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// A node's identity is its bare id: the part after its last `/slots/`.
function identityOf(node: string) {
  return node.split("/slots/").at(-1) ?? node
}

// The items a list and ops both give: an op's item replaces the listed one
// with its id, and the others follow the list.
function merge<T extends { id: string }>(listed: T[], added: T[]) {
  return [
    ...listed.map(
      (item) => added.find((other) => other.id === item.id) ?? item
    ),
    ...added.filter((item) => !listed.some((other) => other.id === item.id)),
  ]
}

function sortKey(sort: readonly { id: string; desc: boolean }[]) {
  return JSON.stringify(sort.map(({ id, desc }) => [id, desc]))
}

function sortingOf(sort: PliantDataTableSortOption["sort"]) {
  return sort.map(({ field, dir }) => ({ id: field, desc: dir === "desc" }))
}

function filtersKey(filters: readonly { id: string; value: unknown }[]) {
  return JSON.stringify(
    filters
      .map(({ id, value }) => [
        id,
        read(value, "operator"),
        read(value, "value"),
      ])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  )
}

function columnFiltersOf(filters: PliantDataTablePreset["filters"]) {
  return filters.map(({ field, ...value }) => ({ id: field, value }))
}

// Whether the table shows anything other than the developer's initial
// state, leaving out the page, which the filters reset.
function hasChanges<TData extends RowData>(
  table: ReactTable<PliantDataTableFeatures, TData>
) {
  const { state, initialState } = table
  const own = table
    .getAllLeafColumns()
    .filter((column) => column.columnDef.meta?.pliant?.type === undefined)
  const ids = own.map((column) => column.id)
  const order = (columnOrder: readonly string[]) =>
    columnOrder.filter((id) => ids.includes(id))
  const initialOrder = order(initialState.columnOrder)
  return (
    !same(state.sorting, initialState.sorting) ||
    !same(state.columnFilters, initialState.columnFilters) ||
    !same(state.grouping, initialState.grouping) ||
    !same(state.columnPinning, initialState.columnPinning) ||
    state.pagination.pageSize !== initialState.pagination.pageSize ||
    !same(order(state.columnOrder), [
      ...initialOrder,
      ...ids.filter((id) => !initialOrder.includes(id)),
    ]) ||
    own.some(
      (column) =>
        column.getIsVisible() !==
          (initialState.columnVisibility[column.id] ?? true) ||
        column.getSize() !==
          (initialState.columnSizing[column.id] ?? column.columnDef.size ?? 150)
    )
  )
}

function PliantDataTableSearch<TData extends RowData>({
  column,
  label,
}: {
  column: TableColumn<TData>
  label: string
}) {
  const messages = usePliantMessages(toolbarMessages)
  const filter = column.getFilterValue()
  const text =
    read(filter, "operator") === "contains" ? read(filter, "value") : filter
  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={messages.dataTableFilterPlaceholder(label)}
      value={typeof text === "string" ? text : ""}
      onChange={(event) => {
        const value = event.target.value
        column.setFilterValue(
          value ? { operator: "contains", value } : undefined
        )
      }}
      className="h-8 w-40 lg:w-64"
    />
  )
}

function PliantDataTableToggle<TData extends RowData>({
  column,
  label,
}: {
  column: TableColumn<TData>
  label: string
}) {
  const filter = column.getFilterValue()
  const pressed =
    filter === true ||
    (read(filter, "operator") === "eq" && read(filter, "value") === true)
  return (
    <Button
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      className="border-dashed aria-pressed:border-solid aria-pressed:bg-accent aria-pressed:text-accent-foreground"
      onClick={() => {
        column.setFilterValue(
          pressed ? undefined : { operator: "eq", value: true }
        )
      }}
    >
      {label}
    </Button>
  )
}

function PliantDataTableChoice({
  label,
  value,
  choices,
  onChoose,
}: {
  label: string
  value: string
  choices: readonly { id: string; label: string }[]
  onChoose: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {label} <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={onChoose}>
          {choices.map((choice) => (
            <DropdownMenuRadioItem key={choice.id} value={choice.id}>
              {choice.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The bar above a data table: its filters, then a Reset button, and on the
 * other side the sort options, the presets, the app's own buttons
 * (`children`) and the columns menu.
 *
 * The filters are the ones in `filters`, then the ones `addFilterControl`
 * ops add to the table; sort options and presets come from their props and
 * from `addSortOption` and `addPreset` ops the same way. An op's item
 * replaces a listed one with the same id. A filter shows when its field is
 * a column that can be filtered:
 * - `search`: a text box, which filters as `contains`;
 * - `multi-select` and `select`: a menu of the column's values with the
 *   number of rows for each, which filters as `in` or `eq`;
 * - `toggle`: a button that filters as `eq` `true` while pressed.
 *
 * Other controls aren't shown. Picking a sort option replaces the sort, and
 * picking a preset replaces the filters, and the sort when it has one.
 *
 * Reset shows while the table differs from its initial state. It puts back
 * the sort, filters, grouping, page, and the columns' order, visibility,
 * sizes and pins, and removes the derived columns, aggregates, highlights,
 * filters, sort options and presets the user added to the table.
 */
function PliantDataTableToolbar<TData extends RowData>({
  table,
  node,
  filters = [],
  sortOptions = [],
  presets = [],
  formatValue,
  children,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children"> & {
  /** The table from `useTable`, with the options from `usePliantTable`. */
  table: ReactTable<PliantDataTableFeatures, TData>
  /** The table node's id, as given to `usePliantTable`. */
  node: string
  /** The filters to show, before those that ops add. */
  filters?: PliantDataTableFilterControl[]
  /** The sort options to offer, before those that ops add. */
  sortOptions?: PliantDataTableSortOption[]
  /** The presets to offer, before those that ops add. */
  presets?: PliantDataTablePreset[]
  /**
   * Names a value in a `select` or `multi-select` filter, given the field.
   * Defaults to the value as text.
   */
  formatValue?: (value: PliantDataTableFacet, field: string) => string
  /** More buttons, shown before the columns menu. */
  children?: ReactNode
}) {
  const messages = usePliantMessages(toolbarMessages)
  const store = usePliantStore()
  const resolved = useResolved()
  const resolvedOps = Array.from(
    resolved.properties.get(identityOf(node)) ?? [],
    ([property, { winner }]) => ({
      property,
      op: winner.check.op,
      layer: winner.overlay.layer,
    })
  )
  const added = <Name extends Op["op"]>(name: Name) =>
    resolvedOps
      .map(({ op }) => op)
      .filter((op): op is Extract<Op, { op: Name }> => op.op === name)
  // A user item's property is its kind and id, such as `highlight.overdue`.
  const userItems = resolvedOps.flatMap(({ property, op, layer }) => {
    const [kind = "", ...id] = property.split(".")
    return userItemKinds.includes(kind) &&
      op.op !== "removeUserItem" &&
      (layer === "personal" || layer === "session")
      ? [{ id: id.join("."), layer }]
      : []
  })

  const columns = table.getAllLeafColumns()
  const controls = merge(
    filters.map((control) => ({ ...control, id: control.id ?? control.field })),
    added("addFilterControl")
  ).flatMap((control) => {
    const column = columns.find(
      (other) => other.id === control.field && other.getCanFilter()
    )
    return column
      ? [
          {
            ...control,
            column,
            label:
              control.label ?? column.columnDef.meta?.label ?? control.field,
          },
        ]
      : []
  })
  const sorts = merge(sortOptions, added("addSortOption"))
  const views = merge(presets, added("addPreset"))
  const sorting = sortKey(table.state.sorting)
  const filtering = filtersKey(table.state.columnFilters)
  const changed = userItems.length > 0 || hasChanges(table)

  function reset() {
    for (const layer of ["personal", "session"] as const) {
      const ops = userItems
        .filter((item) => item.layer === layer)
        .map(({ id }): Op => ({ op: "removeUserItem", target: node, id }))
      if (ops.length > 0) {
        store.applyOps(layer, ops)
      }
    }
    table.resetSorting()
    table.resetColumnFilters()
    table.resetGrouping()
    table.resetColumnVisibility()
    table.resetColumnOrder()
    table.resetColumnPinning()
    table.resetColumnSizing()
    table.resetPagination()
    table.resetExpanded()
  }

  return (
    <div
      {...props}
      data-slot="pliant-data-table-toolbar"
      className={cn(
        "flex flex-wrap items-start justify-between gap-2",
        className
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {controls.map(({ id, field, control, column, label }) =>
          control === "search" ? (
            <PliantDataTableSearch key={id} column={column} label={label} />
          ) : control === "select" || control === "multi-select" ? (
            <PliantDataTableFacetedFilter
              key={id}
              column={column}
              title={label}
              multiple={control === "multi-select"}
              {...(formatValue && {
                formatValue: (value: PliantDataTableFacet) =>
                  formatValue(value, field),
              })}
            />
          ) : control === "toggle" ? (
            <PliantDataTableToggle key={id} column={column} label={label} />
          ) : null
        )}
        {changed ? (
          <Button variant="ghost" size="sm" onClick={reset}>
            {messages.dataTableReset}
            <X />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sorts.length > 0 ? (
          <PliantDataTableChoice
            label={messages.dataTableSort}
            value={
              sorts.find(
                (option) => sortKey(sortingOf(option.sort)) === sorting
              )?.id ?? ""
            }
            choices={sorts}
            onChoose={(id) => {
              const option = sorts.find((other) => other.id === id)
              if (option) {
                table.setSorting(sortingOf(option.sort))
              }
            }}
          />
        ) : null}
        {views.length > 0 ? (
          <PliantDataTableChoice
            label={messages.dataTablePresets}
            value={
              views.find(
                (preset) =>
                  filtersKey(columnFiltersOf(preset.filters)) === filtering &&
                  (!preset.sort || sortKey(sortingOf(preset.sort)) === sorting)
              )?.id ?? ""
            }
            choices={views}
            onChoose={(id) => {
              const preset = views.find((other) => other.id === id)
              if (preset) {
                table.setColumnFilters(columnFiltersOf(preset.filters))
                if (preset.sort) {
                  table.setSorting(sortingOf(preset.sort))
                }
              }
            }}
          />
        ) : null}
        {children}
        <PliantDataTableViewOptions table={table} />
      </div>
    </div>
  )
}

export {
  PliantDataTableToolbar,
  type PliantDataTableFilterControl,
  type PliantDataTablePreset,
  type PliantDataTableSortOption,
}
