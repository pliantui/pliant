"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon } from "lucide-react"

import {
  resolveRegion,
  type ByBreakpoint,
  type RegionEntry,
  type RegionLayout,
  type ResolvedRegion,
} from "@pliantui/core"
import {
  usePliantStatus,
  useRegionSlots,
  useResolved,
  useSlotContent,
} from "@pliantui/react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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

function RegionNode({ entry, slots }: { entry: RegionEntry; slots: Slots }) {
  const mode = entry.visible ? "visible" : "hidden"
  if (entry.kind === "wrapper") {
    const className = cn(
      "flex flex-col gap-[inherit]",
      layoutClassName(entry.layout)
    )
    return (
      <React.Activity mode={mode}>
        <div
          data-pliant-id={entry.id}
          data-pliant-pinned={entry.pinned}
          className={cn(className, spanClassName(entry.span, "span"))}
        >
          <RegionEntries
            entries={entry.entries}
            slots={slots}
            className={className}
          />
        </div>
      </React.Activity>
    )
  }
  return (
    <React.Activity mode={mode}>
      <div
        data-pliant-id={entry.id}
        data-pliant-pinned={entry.pinned}
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
    </React.Activity>
  )
}

function CollapsedEntries({
  into,
  label,
  className,
  children,
}: {
  into: NonNullable<RegionEntry["collapsed"]>["into"]
  label: string | undefined
  className: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-pliant-collapse={into}
      className="col-span-full flex flex-col gap-[inherit]"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="self-start">
          {label ?? "More"}
          <ChevronDownIcon
            className={cn("transition-transform", open && "rotate-180")}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        forceMount
        className={cn(className, "data-[state=closed]:hidden")}
      >
        <React.Activity mode={open ? "visible" : "hidden"}>
          {children}
        </React.Activity>
      </CollapsibleContent>
    </Collapsible>
  )
}

type RegionItem =
  | { readonly kind: "entry"; readonly entry: RegionEntry }
  | {
      readonly kind: "collapsed"
      readonly key: string
      readonly into: NonNullable<RegionEntry["collapsed"]>["into"]
      readonly label: string | undefined
      readonly entries: RegionEntry[]
    }

// Collapsed entries are grouped by collapse, at the place of the first one.
function itemsOf(entries: readonly RegionEntry[]) {
  const items: RegionItem[] = []
  const groups = new Map<string, RegionEntry[]>()
  for (const entry of entries) {
    if (!entry.collapsed) {
      items.push({ kind: "entry", entry })
      continue
    }
    const { into, label } = entry.collapsed
    const key = `${into}:${label ?? ""}`
    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      const created = [entry]
      groups.set(key, created)
      items.push({ kind: "collapsed", key, into, label, entries: created })
    }
  }
  return items
}

function RegionEntries({
  entries,
  slots,
  className,
}: {
  entries: readonly RegionEntry[]
  slots: Slots
  className: string
}) {
  return itemsOf(entries).map((item) =>
    item.kind === "entry" ? (
      <RegionNode key={item.entry.id} entry={item.entry} slots={slots} />
    ) : (
      <React.Activity
        key={`collapsed:${item.key}`}
        mode={
          item.entries.some((entry) => entry.visible) ? "visible" : "hidden"
        }
      >
        <CollapsedEntries
          into={item.into}
          label={item.label}
          className={className}
        >
          {item.entries.map((entry) => (
            <RegionNode key={entry.id} entry={entry} slots={slots} />
          ))}
        </CollapsedEntries>
      </React.Activity>
    )
  )
}

function baseRegion(ids: readonly string[]): ResolvedRegion {
  return {
    layout: {},
    entries: ids.map((id) => ({ kind: "slot", id, visible: true })),
  }
}

/**
 * A region whose slots users can reorder, hide, resize, wrap and collapse
 * with overlays. Each slot is rendered inside a `display: contents` wrapper
 * with `data-pliant-id`; give the region its spacing with `gap` classes, not
 * `space-*` or `divide-*`, which would style the wrappers.
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
  useRegionSlots(id, slots)
  const ready = usePliantStatus().status === "ready"
  const layers = useResolved()
  const key = Object.keys(slots).join("\n")
  const region = React.useMemo(() => {
    const ids = key.split("\n").filter(Boolean)
    return ready ? resolveRegion(layers, { id, slots: ids }) : baseRegion(ids)
  }, [ready, layers, id, key])
  const layout = cn(
    "flex flex-col gap-4",
    className,
    layoutClassName(region.layout)
  )

  return (
    <div
      data-slot="pliant-region"
      data-pliant-id={id}
      data-pliant-pending={ready ? undefined : ""}
      className={layout}
      {...props}
    >
      <RegionEntries
        entries={region.entries}
        slots={slots}
        className={layout}
      />
    </div>
  )
}

export { PliantRegion }
