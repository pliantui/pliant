---
name: tables
description: Make a shadcn/TanStack data table customizable with Pliant, so users can sort, filter, hide, reorder, resize, pin and group columns and keep their choices. Use when asked to make a table customizable or reshapeable, use usePliantTable, pliant-data-table or pliant-data-table-toolbar, add column ids and labels, add filters, sort options or presets, group rows, or add aggregates and totals to a table.
---

# Customizable tables

`usePliantTable` turns TanStack Table options into a table that Pliant controls: users' column changes are saved as overlays and applied again on the next visit. This skill covers the table. Adding Pliant to the page (`PliantRoot`, `PliantPrePaint`, regions) is the `setup` skill: if the page has no `PliantRoot` yet, do that first.

The table works on client-side data: you pass all the rows and the table sorts, filters, groups and pages them in the browser.

## Before you start

- The page must have a `PliantRoot` above the table, and the table must be in a client component (a file that starts with `"use client"`).
- The table needs TanStack Table v9 (`@tanstack/react-table`, with `createColumnHelper<TFeatures, TData>` and `useTable`). The registry item below installs it. If the project has a TanStack Table v8 table, stop and tell the user: v8 is not supported.
- Read the existing table first. Keep its cells, formatting and styling, and change only what this skill describes.

## 1. Install the components

The components install through the `@pliant` registry. If `components.json` has no `@pliant` entry under `registries`, run `npx pliantui init --yes` first; it adds the entry.

```bash
npx shadcn@latest add @pliant/pliant-data-table --yes
```

This adds `pliant-data-table`, a sortable header, a columns menu, pagination and the table features to the `pliant` folder inside the project's `components` alias, and installs `@pliantui/react` and `@tanstack/react-table`.

For filters, sort options, presets and a Reset button above the table, also add the toolbar (section 4):

```bash
npx shadcn@latest add @pliant/pliant-data-table-toolbar --yes
```

## 2. Give every column an id and a label

- Every column needs a stable id. Users' saved changes name columns by id, so a column whose id changes loses the changes made to it, and renaming a field renames the id.
- With `accessor("status", …)` the id is the key. Dots become underscores. For `accessorFn` or display columns, set `id` yourself.
- An id must start with a letter and contain only letters, digits, `-` and `_`, at most 64 characters. Prefer kebab-case, or the field name. A column whose id doesn't fit works in the table but its changes are not saved.
- Every column needs `meta: { label }`, the name shown in the header and the columns menu.
- Use `PliantDataTableColumnHeader` as the header of every column that users can sort.

## 3. Use `usePliantTable`

```tsx
"use client"

import { createColumnHelper, useTable } from "@tanstack/react-table"

import { usePliantNodeProps } from "@pliantui/react"
import { usePliantTable } from "@pliantui/react/table"

import { PliantDataTable } from "@/components/pliant/pliant-data-table"
import { PliantDataTableColumnHeader } from "@/components/pliant/pliant-data-table-column-header"
import {
  pliantDataTableFeatures,
  type PliantDataTableFeatures,
} from "@/components/pliant/pliant-data-table-features"
import { PliantDataTablePagination } from "@/components/pliant/pliant-data-table-pagination"
import { PliantDataTableViewOptions } from "@/components/pliant/pliant-data-table-view-options"

interface Invoice {
  id: string
  customer: string
  status: "paid" | "pending"
  amount: number
}

const helper = createColumnHelper<PliantDataTableFeatures, Invoice>()

const columns = helper.columns([
  helper.accessor("id", {
    meta: { label: "Invoice" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("customer", {
    meta: { label: "Customer" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("status", {
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("amount", {
    meta: { label: "Amount" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
])

export function InvoicesTable({ data }: { data: Invoice[] }) {
  const node = usePliantNodeProps("invoices-table")
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: "invoices-table" }
  )
  const table = useTable(options)

  return (
    <div {...node} className="flex flex-col gap-4">
      <h2 id="invoices-title">Invoices</h2>
      <PliantDataTableViewOptions table={table} />
      <PliantDataTable table={table} aria-labelledby="invoices-title" />
      <PliantDataTablePagination table={table} />
    </div>
  )
}
```

- The `id` option is the table node's id. It is kebab-case, starts with a letter and is unique on the page. Pass the same id to `usePliantNodeProps`, and spread the result on the table's wrapper element.
- Pass `features: pliantDataTableFeatures`. It already holds the sorting, grouping, column ordering, pinning, sizing, visibility, row expanding, aggregation and pagination features, and the sorted, grouped, expanded and paginated row models. Pliant adds the others it needs, such as filtering.
- You can still pass `state` and `on…Change` for the slices Pliant manages (sorting, visibility, order, sizing, pinning, filters, grouping, pagination), for example to keep the sorting in the URL. The values from your first render, and your `initialState`, are the base the saved layers are applied on top of. Pliant keeps your `state` in sync with the table, comparing it as data, so state rebuilt on every render is fine. It calls your `on…Change` with each new value, one render after the table gets it, including values that come from ops applied elsewhere, such as the ask panel. Your own changes to the state, such as pushing a new sorting from the URL, become ops and are saved like a click on a header.
- Name the table with `aria-labelledby` or `aria-label`.
- Define `columns` outside the component, or memoize them.

## What users can change, and how it is saved

- Sorting, column visibility, column order, column sizes, column pinning and grouping are saved to the user's personal layer. They come back on the next visit, on this browser with `localAdapter`.
- The registry components give users sorting (the header button), showing or hiding columns (the columns menu), the page size (the pagination), and, with the toolbar, filters, sort options and presets. Order, sizes and pinning are applied from TanStack's own calls, such as `column.pin("start")` or `table.setColumnOrder([...])`, and from ops that arrive another way, such as the ask panel or `applyOps`. Add your own controls for them only if the user asked.
- Pagination stays in the session layer, which lasts for one browser tab and is never saved. Filters stay there too, unless you pass `persistFilters: true`.
- Until the layers have loaded (`usePliantStatus` is `loading`), the table shows your base state and rejects changes.
- Users can hide a column but not delete it, and what they save never changes your data.

## 4. The toolbar (optional)

Only when users should filter the rows, pick from your sort options or presets, or reset the table. `PliantDataTableToolbar` goes above the table and replaces `PliantDataTableViewOptions`, which it includes:

```tsx
import {
  PliantDataTableToolbar,
  type PliantDataTableFilterControl,
  type PliantDataTablePreset,
  type PliantDataTableSortOption,
} from "@/components/pliant/pliant-data-table-toolbar"

const filters: PliantDataTableFilterControl[] = [
  { field: "customer", control: "search" },
  { field: "status", control: "multi-select" },
]

const sortOptions: PliantDataTableSortOption[] = [
  {
    id: "largest",
    label: "Largest first",
    sort: [{ field: "amount", dir: "desc" }],
  },
]

const presets: PliantDataTablePreset[] = [
  {
    id: "pending",
    label: "Pending",
    filters: [{ field: "status", operator: "eq", value: "pending" }],
    sort: [{ field: "amount", dir: "desc" }],
  },
]
```

Render it with the table's id:

```tsx
<PliantDataTableToolbar
  table={table}
  node="invoices-table"
  filters={filters}
  sortOptions={sortOptions}
  presets={presets}
/>
```

- `filters`, `sortOptions` and `presets` have the shape of the `addFilterControl`, `addSortOption` and `addPreset` ops, without `op` and `target`. A filter's `id` defaults to its `field`, which must be a column id. Define them outside the component.
- `search` is a text box that filters as `contains`. `multi-select` and `select` are menus of the column's values with the number of rows for each, filtering as `in` or `eq`. `toggle` is a button that filters for `true`. Other controls aren't shown.
- Ops add to these lists: `addFilterControl`, `addSortOption` and `addPreset` ops on the table show in the toolbar after yours, and one with the id of yours replaces it. `removeUserItem` removes one by id.
- Pass `formatValue` to name the values in the `select` and `multi-select` menus, such as capitalized statuses. Your own buttons, such as a group-by menu, go in `children`, before the columns menu.
- Reset shows while the user has changed the table: its sort, filters, grouping, page size or columns, or the items they added. Moving to another page doesn't count. It drops those changes, and the page, with `usePliantStore().resetNode(node)`, so the table shows as the team and org layers, and then your own setup, have it. It needs a storage adapter with `remove`, which `localAdapter` and `serverAdapter` have.
- Filters stay in the session layer, unless the table has `persistFilters: true`, and a sort option saves its sort like a header click.

## 5. Grouping and aggregates (optional)

Only when users should see totals or counts, or group rows. Pass `dataset` to `usePliantTable`: the fields the aggregates read, and the time zone dates are read in. Define it outside the component.

```tsx
const invoicesDataset = {
  fields: {
    id: { type: "id" },
    customer: { type: "string" },
    status: { type: "enum", values: ["paid", "pending"] },
    amount: { type: "currency", currency: "USD" },
  },
  timeZone: "UTC",
} as const

const options = usePliantTable(
  { features: pliantDataTableFeatures, data, columns },
  { id: "invoices-table", dataset: invoicesDataset }
)
```

Without `dataset`, a table shows no aggregates. A table with a grouping and aggregates shows a row per group with the aggregates' values and expands to its rows, and a total for each aggregate column.

Nothing in the registry components groups rows for the user: the app applies `setGroupBy` and `addAggregate` ops itself, as one `applyOps` call to the personal layer. This menu does what the orders example's Group-by menu does:

```tsx
"use client"

import { usePliantStore } from "@pliantui/react"

import { Button } from "@/components/ui/button"

export function GroupByStatus({
  node,
  grouped,
}: {
  node: string
  grouped: boolean
}) {
  const store = usePliantStore()

  function toggle() {
    const result = store.applyOps(
      "personal",
      grouped
        ? [
            { op: "setGroupBy", target: node, fields: [] },
            { op: "removeUserItem", target: node, id: "total-amount" },
          ]
        : [
            { op: "setGroupBy", target: node, fields: ["status"] },
            {
              op: "addAggregate",
              target: node,
              id: "total-amount",
              label: "Total amount",
              expr: { fn: "sum", args: [{ field: "amount" }] },
            },
          ]
    )
    if (!result.success) {
      console.error(result.error)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      {grouped ? "Ungroup" : "Group by status"}
    </Button>
  )
}
```

Render it inside the table's component with `node="invoices-table"` and `grouped={table.state.grouping.length > 0}`.

- `target` is the table's node id. `fields` are field ids from `dataset.fields`, and they are column ids too. `setGroupBy` replaces the whole list.
- An aggregate's `id` and `label` are yours. Its `expr` uses functions such as `sum`, `count` and `mean` over `{ field }` references: [Expressions](https://pliantui.dev/docs/concepts/expressions) lists them. An aggregate whose expression doesn't check against `dataset.fields`, or whose `id` is a column's id, is saved but not shown, and an error is reported to `PliantRoot`'s `onError` (to `console.error` when there is none).
- `removeUserItem` removes an aggregate by id. Always read the returned result: `success` is `false` with an `error` when an op is rejected, which otherwise fails silently. An aggregate's `id` must not be a column's id.
- To show an aggregate's value your way, pass `formatAggregate` to `PliantDataTable`.

## 6. Derived columns (optional)

Only when users should add a calculated column, such as a value with tax or each row's share of the total. It needs the same `dataset` as aggregates, and the app applies an `addDerived` op to the personal layer, like the group menu does:

```tsx
store.applyOps("personal", [
  {
    op: "addDerived",
    target: "invoices-table",
    id: "amount-share",
    label: "Share of amount",
    expr: { fn: "share", args: [{ field: "amount" }] },
    format: { type: "percent", decimals: 1 },
  },
])
```

- The column has a value on every data row. It sorts, hides, moves and pins like a data column, and a column without window functions filters and groups too. `removeUserItem` removes it by id.
- A window function (`share`, `rank`, `runningSum`) gives a row its value over its group, or over the filtered rows in an ungrouped table. A column that uses one can't be filtered or grouped by.
- `PliantDataTable` shows a derived column with a sortable header and its values by `format`; `formatAggregate` can format them your way, and gets the `format` as its third argument. A derived column's `id` must not be a column's id.
- An expression that doesn't check against `dataset.fields` is saved but not shown, and an error is reported, as for aggregates.

## 7. Highlights (optional)

Only when users should mark rows that meet a condition, such as overdue invoices. It needs the same `dataset`, and the app applies an `addHighlight` op to the personal layer:

```tsx
store.applyOps("personal", [
  {
    op: "addHighlight",
    target: "invoices-table",
    id: "overdue-invoices",
    when: { fn: "eq", args: [{ field: "status" }, { value: "overdue" }] },
    tone: "danger",
  },
])
```

- `when` must be true or false. It can use window functions and `ref` derived columns, like a derived column. `tone` is `emphasis`, `success`, `warning` or `danger`. `removeUserItem` removes it by id.
- `PliantDataTable` tints a highlighted row with its tone and adds an icon and text for screen readers, so the highlight doesn't rest on color alone. Pass `formatHighlight` to name each highlight in that text, such as "Highlighted: Overdue"; by default it names the tone.
- Elsewhere, `getPliantHighlights(row)` from `@pliantui/react/table` lists a row's highlights, in the order their ops applied.
- A `when` that doesn't check against `dataset.fields`, or isn't true or false, is saved but not shown, and an error is reported, as for aggregates.

## 8. Verify

1. Run the project's typecheck and `next build`. Fix the errors your change caused.
2. Load the page. Every header should show its `meta.label`, and the columns menu should list the columns that can be hidden. With the toolbar, a filter should narrow the rows and Reset should bring them back.
3. Click a header to sort, hide a column in the menu and reload the page: both should still apply.
4. Open the page in another tab. Page and filters should be back to the defaults, and sort and hidden columns kept.
5. With a `dataset`, group by a column and check that groups expand and the aggregate shows a total, and that an added derived column shows its values and an added highlight marks its rows.

## Common mistakes

- A column without `meta.label`: the type check fails, and the header and the menu have no name.
- Changing a column's id, or building ids from something that changes, such as an index or a translated label.
- Two tables on one page with the same `id`, or an `id` that is not kebab-case.
- Calling `usePliantTable` outside `PliantRoot`, or in a Server Component.
- Expecting `table.setPageIndex(…)` or filters to be saved. They are per tab, and filters need `persistFilters` to be saved.
- Aggregates, derived columns, highlights or grouping without `dataset`, or `fields` that name a field missing from `dataset.fields`.
- Fetching rows page by page and giving the table one page of data. The table groups, sorts and filters only the rows it has.
- Creating `columns` or `dataset` inside the component, so they change on every render.

## Docs

- [Operations](https://pliantui.dev/docs/concepts/operations): the table ops and what renders.
- [Overlays and layers](https://pliantui.dev/docs/concepts/layers): why sorting, hiding and grouping stack the way they do.
- [Expressions and functions](https://pliantui.dev/docs/concepts/expressions): the functions an aggregate, a derived column or a highlight can use.
- [Guardrails](https://pliantui.dev/docs/concepts/guardrails): what is never saved.
