"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

import type { ByBreakpoint, RegionEntry, RegionLayout } from "@pliantui/core"
import {
  PliantActivity,
  usePliantNode,
  usePliantRegion,
  useRegionItems,
  useSlotContent,
  type RegionItem,
} from "@pliantui/react"

import { Button } from "@/components/ui/button"

type Breakpoint = keyof ByBreakpoint<never>
type Columns = readonly [string, string, string, string]

interface BreakpointClasses {
  readonly stack: string
  readonly row: string
  readonly grid: string
  readonly columns: Columns
  readonly align: Readonly<
    Record<"start" | "center" | "end" | "between", string>
  >
  readonly span: Columns
  readonly childSpan: Columns
  readonly fullSpan: string
  readonly autoSpan: string
}

// Written out in full so Tailwind finds every class in the source.
const breakpointClasses: Readonly<Record<Breakpoint, BreakpointClasses>> = {
  base: {
    stack: "flex flex-col",
    row: "flex flex-row",
    grid: "grid",
    columns: ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"],
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      between: "justify-between",
    },
    span: ["col-span-1", "col-span-2", "col-span-3", "col-span-4"],
    childSpan: ["*:col-span-1", "*:col-span-2", "*:col-span-3", "*:col-span-4"],
    fullSpan: "col-span-full",
    autoSpan: "col-auto",
  },
  sm: {
    stack: "sm:flex sm:flex-col",
    row: "sm:flex sm:flex-row",
    grid: "sm:grid",
    columns: [
      "sm:grid-cols-1",
      "sm:grid-cols-2",
      "sm:grid-cols-3",
      "sm:grid-cols-4",
    ],
    align: {
      start: "sm:items-start",
      center: "sm:items-center",
      end: "sm:items-end",
      between: "sm:justify-between",
    },
    span: ["sm:col-span-1", "sm:col-span-2", "sm:col-span-3", "sm:col-span-4"],
    childSpan: [
      "sm:*:col-span-1",
      "sm:*:col-span-2",
      "sm:*:col-span-3",
      "sm:*:col-span-4",
    ],
    fullSpan: "sm:col-span-full",
    autoSpan: "sm:col-auto",
  },
  md: {
    stack: "md:flex md:flex-col",
    row: "md:flex md:flex-row",
    grid: "md:grid",
    columns: [
      "md:grid-cols-1",
      "md:grid-cols-2",
      "md:grid-cols-3",
      "md:grid-cols-4",
    ],
    align: {
      start: "md:items-start",
      center: "md:items-center",
      end: "md:items-end",
      between: "md:justify-between",
    },
    span: ["md:col-span-1", "md:col-span-2", "md:col-span-3", "md:col-span-4"],
    childSpan: [
      "md:*:col-span-1",
      "md:*:col-span-2",
      "md:*:col-span-3",
      "md:*:col-span-4",
    ],
    fullSpan: "md:col-span-full",
    autoSpan: "md:col-auto",
  },
  lg: {
    stack: "lg:flex lg:flex-col",
    row: "lg:flex lg:flex-row",
    grid: "lg:grid",
    columns: [
      "lg:grid-cols-1",
      "lg:grid-cols-2",
      "lg:grid-cols-3",
      "lg:grid-cols-4",
    ],
    align: {
      start: "lg:items-start",
      center: "lg:items-center",
      end: "lg:items-end",
      between: "lg:justify-between",
    },
    span: ["lg:col-span-1", "lg:col-span-2", "lg:col-span-3", "lg:col-span-4"],
    childSpan: [
      "lg:*:col-span-1",
      "lg:*:col-span-2",
      "lg:*:col-span-3",
      "lg:*:col-span-4",
    ],
    fullSpan: "lg:col-span-full",
    autoSpan: "lg:col-auto",
  },
  xl: {
    stack: "xl:flex xl:flex-col",
    row: "xl:flex xl:flex-row",
    grid: "xl:grid",
    columns: [
      "xl:grid-cols-1",
      "xl:grid-cols-2",
      "xl:grid-cols-3",
      "xl:grid-cols-4",
    ],
    align: {
      start: "xl:items-start",
      center: "xl:items-center",
      end: "xl:items-end",
      between: "xl:justify-between",
    },
    span: ["xl:col-span-1", "xl:col-span-2", "xl:col-span-3", "xl:col-span-4"],
    childSpan: [
      "xl:*:col-span-1",
      "xl:*:col-span-2",
      "xl:*:col-span-3",
      "xl:*:col-span-4",
    ],
    fullSpan: "xl:col-span-full",
    autoSpan: "xl:col-auto",
  },
  "2xl": {
    stack: "2xl:flex 2xl:flex-col",
    row: "2xl:flex 2xl:flex-row",
    grid: "2xl:grid",
    columns: [
      "2xl:grid-cols-1",
      "2xl:grid-cols-2",
      "2xl:grid-cols-3",
      "2xl:grid-cols-4",
    ],
    align: {
      start: "2xl:items-start",
      center: "2xl:items-center",
      end: "2xl:items-end",
      between: "2xl:justify-between",
    },
    span: [
      "2xl:col-span-1",
      "2xl:col-span-2",
      "2xl:col-span-3",
      "2xl:col-span-4",
    ],
    childSpan: [
      "2xl:*:col-span-1",
      "2xl:*:col-span-2",
      "2xl:*:col-span-3",
      "2xl:*:col-span-4",
    ],
    fullSpan: "2xl:col-span-full",
    autoSpan: "2xl:col-auto",
  },
}

const breakpoints: readonly Breakpoint[] = [
  "base",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
]

// A layout applies from its breakpoint up, so it is repeated at every larger
// breakpoint to win over the developer's own classes there.
function layoutClassName(layout: ByBreakpoint<RegionLayout>) {
  let current: RegionLayout | undefined
  return cn(
    breakpoints.map((breakpoint) => {
      current = layout[breakpoint] ?? current
      if (!current) {
        return undefined
      }
      const classes = breakpointClasses[breakpoint]
      return [
        classes[current.mode],
        current.mode === "grid" &&
          current.columns !== undefined &&
          classes.columns[current.columns - 1],
        current.align && classes.align[current.align],
      ]
    })
  )
}

// Without a span, a wrapper laid out as a row or a grid of several columns
// spans its container's full width, so its content never overflows a column.
function wrapperSpanClassName(layout: ByBreakpoint<RegionLayout>) {
  let current: RegionLayout | undefined
  let wide = false
  const className = cn(
    breakpoints.map((breakpoint) => {
      current = layout[breakpoint] ?? current
      const next =
        current?.mode === "row" ||
        (current?.mode === "grid" && (current.columns ?? 1) > 1)
      if (next === wide) {
        return undefined
      }
      wide = next
      const classes = breakpointClasses[breakpoint]
      return wide ? classes.fullSpan : classes.autoSpan
    })
  )
  return className || undefined
}

function spanClassName(
  span: ByBreakpoint<number> | undefined,
  target: "span" | "childSpan"
) {
  const className = cn(
    breakpoints.map((breakpoint) => {
      const columns = span?.[breakpoint]
      return columns && breakpointClasses[breakpoint][target][columns - 1]
    })
  )
  return className || undefined
}

type InsertedNode = Extract<RegionEntry, { kind: "inserted" }>["node"]

/**
 * Renderers for the nodes an `insert` op adds, by `kind`. A kind with no
 * renderer shows a placeholder.
 */
const insertedNodeRenderers: Partial<
  Record<string, (node: InsertedNode) => React.ReactNode>
> = {}

function InsertedNodeContent({ node }: { node: InsertedNode }) {
  const render = insertedNodeRenderers[node.kind]
  if (render) {
    return render(node)
  }
  return (
    <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
      {node.label ?? node.kind} can&apos;t be shown yet
    </div>
  )
}

function MovedSlotContent({ id }: { id: string }) {
  return useSlotContent(id)
}

type Slots = Readonly<Record<string, React.ReactNode>>

function RegionNode({
  item,
  slots,
}: {
  item: Extract<RegionItem, { kind: "entry" }>
  slots: Slots
}) {
  const { entry } = item
  return (
    <PliantActivity mode={item.mode}>
      {entry.kind === "wrapper" ? (
        <div
          {...item.props}
          className={cn(
            "grid gap-[inherit]",
            layoutClassName(entry.layout),
            entry.span
              ? spanClassName(entry.span, "span")
              : wrapperSpanClassName(entry.layout)
          )}
        >
          <RegionEntries entries={entry.entries} slots={slots} />
        </div>
      ) : (
        <div
          {...item.props}
          className={spanClassName(entry.span, "childSpan")}
          style={{ display: "contents" }}
        >
          {entry.kind === "inserted" ? (
            <InsertedNodeContent node={entry.node} />
          ) : Object.hasOwn(slots, entry.id) ? (
            slots[entry.id]
          ) : (
            <MovedSlotContent id={entry.id} />
          )}
        </div>
      )}
    </PliantActivity>
  )
}

function CollapseTrigger({
  item,
}: {
  item: Extract<RegionItem, { kind: "trigger" }>
}) {
  return (
    <Button
      {...item.props}
      variant="ghost"
      size="sm"
      className="col-span-full -ml-2.5 self-start justify-self-start"
    >
      {item.label ?? "More"}
      <ChevronDownIcon
        className={cn("transition-transform", item.open && "rotate-180")}
      />
    </Button>
  )
}

function RegionEntries({
  entries,
  slots,
}: {
  entries: readonly RegionEntry[]
  slots: Slots
}) {
  return useRegionItems(entries).map((item) =>
    item.kind === "trigger" ? (
      <CollapseTrigger key={item.key} item={item} />
    ) : (
      <RegionNode key={item.key} item={item} slots={slots} />
    )
  )
}

/**
 * A region whose slots users can reorder, hide, resize, wrap and collapse
 * with overlays. Each slot is rendered inside a `display: contents` wrapper
 * with `data-pliant-id`; give the region its spacing with `gap` classes, not
 * `space-*` or `divide-*`, which would style the wrappers. A slot's span
 * applies to each of its root elements, so a slot that renders a fragment
 * spans with every element in it.
 */
function PliantRegion({
  id,
  slots,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "id" | "children"> & {
  /** The region's node id: kebab-case, unique within the surface. */
  id: string
  /**
   * The region's content by slot id. The key order is the base order, so
   * keys must be kebab-case and start with a letter.
   */
  slots: Slots
}) {
  const node = usePliantNode(id)
  const region = usePliantRegion(id, slots)
  return (
    <div
      {...props}
      data-slot="pliant-region"
      {...node}
      className={cn("grid gap-4", className, layoutClassName(region.layout))}
    >
      <RegionEntries entries={region.entries} slots={slots} />
    </div>
  )
}

export { PliantRegion }
