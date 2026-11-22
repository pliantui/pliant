---
name: setup
description: Add Pliant to a Next.js App Router app that uses shadcn/ui, so its users can reorder, hide and resize parts of a page. Use when asked to set up, install, integrate or try Pliant, to wrap a page in PliantRoot, add a PliantRegion, or make a table reshapeable with usePliantTable.
---

# Set up Pliant

Pliant lets the users of a shadcn app reshape its pages: reorder, hide, pin and resize parts of a page and the columns of a table. This skill adds it to a Next.js App Router project that already uses shadcn/ui.

## Before you start

- The project needs Next.js with an `app` or `src/app` folder and a `components.json`. If `components.json` is missing, run `npx shadcn@latest init` first.
- Other frameworks and the Pages Router are not supported. Stop and tell the user instead of improvising.
- Ask which route to start with if the user didn't say. One page is enough.

## 1. Install

```bash
npx pliantui init --yes
```

This adds `@pliantui/react` with the project's package manager and the `pliant-region` component to the `pliant` folder inside the `components` alias from `components.json` (usually `components/pliant`). Without `--yes` it asks before each step and needs an interactive terminal, which agent shells usually aren't. Running it again is safe: it skips what is installed.

## 2. Wrap a route

Pliant works on one page at a time. Its name for a page is the surface: the route pattern, such as `/orders` or `/orders/[id]`. Use the pattern, never the URL, so one customization applies to every order page.

Wrap the page's content in `PliantRoot`, add `PliantPrePaint` with the same `surface`, and put the parts users may rearrange in a `PliantRegion`:

```tsx
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

const surface = "/orders/[id]" // this page's route pattern

export default function Page() {
  return (
    <PliantRoot surface={surface} storage={localAdapter}>
      <PliantPrePaint surface={surface} />
      <PliantRegion
        id="summary"
        slots={{ total: <OrderTotal />, status: <OrderStatus /> }}
      />
    </PliantRoot>
  )
}
```

Rules that matter:

- `PliantRoot` and `PliantPrePaint` must get the same `surface`. `PliantPrePaint` stops a customized page from flashing its original layout.
- The page can stay a Server Component. Slot content can be Server Components too.
- A region `id` is kebab-case, starts with a letter, and is unique on the page. Slot ids, the keys of `slots`, are kebab-case too. The key order is the base order.
- Reuse the page's existing parts as slots: move each existing block into `slots`, keep its markup, and keep the region's spacing in `gap` classes. Don't use `space-*` or `divide-*` on a region, because slots sit in wrapper elements.
- `storage={localAdapter}` keeps changes in the browser. Pass `localAdapter` itself, not `localAdapter()`: a Server Component can pass it because it comes from a client module. For any other storage, such as `serverAdapter`, render `PliantRoot` inside a client component (a file that starts with `"use client"`) that creates the storage, and use that component from the page.

## 3. Add a table (optional)

Only for pages that have a data table. Add the table components:

```bash
npx shadcn@latest add https://pliantui.dev/r/pliant-data-table.json --yes
```

Build the table in a client component with TanStack Table, pass its options through `usePliantTable`, and give the table node an id:

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

interface Order {
  id: string
  status: string
  value: number
}

const helper = createColumnHelper<PliantDataTableFeatures, Order>()

const columns = helper.columns([
  helper.accessor("id", {
    meta: { label: "Order" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("status", {
    meta: { label: "Status" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
  helper.accessor("value", {
    meta: { label: "Value" },
    header: ({ column }) => <PliantDataTableColumnHeader column={column} />,
  }),
])

export function OrdersTable({ data }: { data: Order[] }) {
  const node = usePliantNodeProps("orders-table")
  const options = usePliantTable(
    { features: pliantDataTableFeatures, data, columns },
    { id: "orders-table" }
  )
  const table = useTable(options)

  return (
    <div {...node} className="flex flex-col gap-4">
      <h2 id="orders-title">Orders</h2>
      <PliantDataTableViewOptions table={table} />
      <PliantDataTable table={table} aria-labelledby="orders-title" />
      <PliantDataTablePagination table={table} />
    </div>
  )
}
```

Render `OrdersTable` inside the page's `PliantRoot`, either directly or as a region slot. Notes:

- Give every column a stable id. Users' saved changes refer to columns by id, so a column whose id changes loses the changes made to it.
- Pass `dataset` (the table's `fields` and `timeZone`) to `usePliantTable` only if users should be able to add aggregates such as totals.
- Name the table with `aria-labelledby` or `aria-label`.

## 4. Describe your components (optional)

```bash
npx pliantui manifest --yes
```

This reads the `cva` and `tailwind-variants` definitions in the ui folder, without running your code, and writes `manifests.generated.ts` and `manifest-decisions.json` to the `pliant` folder inside the `lib` alias. A manifest says what users may change about a component. Don't edit the generated file; run the command again. Commit `manifest-decisions.json`. Anything that needs a human decision is left out under `--yes` and reported, so tell the user how many items were left out.

## 5. Verify

1. Run the project's typecheck and `next build`. Fix the errors your change caused; don't touch unrelated ones.
2. Run `npx pliantui doctor --json` and fix every check whose `status` is `fail`, using its `fix`. It checks that each `PliantRoot` has a `PliantPrePaint` with the same `surface`; check yourself that the surface is the route pattern.
3. Start the dev server and load the route. The page's HTML should contain `data-slot="pliant-region"` for each region and `data-pliant-id` on each slot.
4. Prove a change applies. Temporarily add a client component inside `PliantRoot` with a button that calls `usePliantStore().applyOps("personal", [{ op: "hide", target: "summary/slots/status" }])`, using your own region and slot ids. Import `usePliantStore` from `@pliantui/react`, and log the returned result: `success` is `false` with an `error` when the op is rejected, which otherwise fails silently. After the click the slot should disappear from the page. Remove the component afterwards.

## Common mistakes

- Different `surface` strings on `PliantRoot` and `PliantPrePaint`, or a URL such as `/orders/42` instead of the pattern `/orders/[id]`.
- Hooks such as `usePliantTable`, `usePliantStore` or `usePliantNodeProps` used in a Server Component. Put them in a file that starts with `"use client"`.
- A region or slot id that is not kebab-case, starts with a digit, or is repeated on the page.
- Two nodes with the same id on one page. Ids are unique across the surface.
- Importing `PliantRegion` from `@pliantui/react`. It is a component added to the project: import it from `@/components/pliant/pliant-region`, or from wherever the `components` alias in `components.json` points.
- Passing `localAdapter()`, called, or a `storage` object made in a Server Component to `PliantRoot`. From a Server Component, pass `localAdapter` itself.
- Running `pliantui init` in an agent shell without `--yes`: it exits with an error asking for an interactive terminal.
- Using `space-y-*` on a region instead of `gap-*`.

## Docs

- [Surfaces, nodes and addresses](https://pliantui.dev/docs/concepts/surfaces): how pages, regions, tables and their items are named.
- [Operations](https://pliantui.dev/docs/concepts/operations): what users can change and what renders.
- [Overlays and layers](https://pliantui.dev/docs/concepts/layers): how org, team, personal and session changes stack.
- [Guardrails](https://pliantui.dev/docs/concepts/guardrails): what users can't change.
- [CLI](https://pliantui.dev/docs/cli): `init`, `manifest`, `scan`, `doctor` and `skills`.
