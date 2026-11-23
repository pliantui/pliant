"use client"

import { useMemo, useRef, type ComponentProps, type ReactNode } from "react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"
import { cn } from "cn"
import { ChevronDown } from "lucide-react"

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
  PliantCustomizeMenu,
  type PliantCustomizeActions,
} from "./pliant-customize-menu"
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
  }
}

const toolbarMessages = {
  dataTableFilterPlaceholder: (label) => `Filter ${label.toLowerCase()}…`,
  dataTableSort: "Sort",
  dataTablePresets: "Presets",
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

function read(source: unknown, key: string): unknown {
  return typeof source === "object" && source !== null
    ? Reflect.get(source, key)
    : undefined
}

// A node's identity is its bare id: the part after its last `/slots/`.
function identityOf(node: string) {
  return node.split("/slots/").at(-1) ?? node
}

// A node's span, visibility and insertion belong to its container, which
// `resetNode` leaves alone.
const containerProperties = ["span", "visible", "inserted"]

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
 * The bar above a data table: its filters, and on the other side the sort
 * options, the presets, the app's own buttons (`children`), the columns menu
 * and the table's Customize menu.
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
 * The Customize menu's Reset to default is on while the user has changed
 * the table: its sort, filters, grouping, rows per page, columns, or the
 * items they added, and the menu marks the table as customized. Reset drops
 * those changes with `resetNode`, so the table shows as the team and org
 * layers, and then your own setup, have it. Adjust by hand moves focus to
 * the first filter or button. Ask and History run what `customize` gives.
 */
function PliantDataTableToolbar<TData extends RowData>({
  table,
  node,
  filters = [],
  sortOptions = [],
  presets = [],
  formatValue,
  customize,
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
  /**
   * The Customize menu's other items, such as `onAsk` to open the ask panel
   * about the table. Reset to default and Adjust by hand come from the
   * toolbar.
   */
  customize?: Omit<PliantCustomizeActions, "onReset" | "canReset">
  /** More buttons, shown before the columns menu. */
  children?: ReactNode
}) {
  const messages = usePliantMessages(toolbarMessages)
  const store = usePliantStore()
  const resolved = useResolved()
  const identity = identityOf(node)
  // Whether the user's personal or session layer changes the table or its
  // items, as `resetNode` drops. Moving between pages doesn't count, though
  // Reset drops it too: only a `setPage` that sets the rows per page does.
  const changed = useMemo(
    () =>
      Array.from(resolved.properties).some(
        ([address, properties]) =>
          (address === identity || address.startsWith(`${identity}/`)) &&
          Array.from(properties).some(([property, { winner }]) => {
            const { op } = winner.check
            return (
              (winner.overlay.layer === "personal" ||
                winner.overlay.layer === "session") &&
              !(
                address === identity && containerProperties.includes(property)
              ) &&
              !(op.op === "setPage" && op.size === undefined)
            )
          })
      ),
    [resolved, identity]
  )
  const toolbar = useRef<HTMLDivElement>(null)
  const added = <Name extends Op["op"]>(name: Name) =>
    Array.from(
      resolved.properties.get(identity)?.values() ?? [],
      ({ winner }) => winner.check.op
    ).filter((op): op is Extract<Op, { op: Name }> => op.op === name)

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

  function reset() {
    // A rejection reaches `PliantRoot`'s `onError` from the store.
    if (store.resetNode(node).success) {
      table.resetExpanded()
    }
  }

  function adjust() {
    Array.from(
      toolbar.current?.querySelectorAll<HTMLElement>("input, button") ?? []
    )
      .find(
        (control) =>
          !control.matches(":disabled, [hidden], [hidden] *, [inert] *")
      )
      ?.focus()
  }

  return (
    <div
      ref={toolbar}
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
        <PliantCustomizeMenu
          {...customize}
          customized={changed}
          canReset={changed}
          onReset={reset}
          onAdjust={customize?.onAdjust ?? adjust}
        />
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
