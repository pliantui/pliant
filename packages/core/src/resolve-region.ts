import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import { identityOf } from "./node-identity"
import { orderItems } from "./order-items"
import type { PlacementPosition } from "./placement"
import type { ResolvedLayers } from "./resolve-layers"

type InsertOp = Extract<Op, { op: "insert" }>
type WrapOp = Extract<Op, { op: "wrap" }>
type LayoutOp = Extract<Op, { op: "setLayout" }> | WrapOp

/** A layout from `setLayout` or `wrap`, without its target or breakpoint. */
export type RegionLayout =
  | {
      readonly mode: "stack" | "row"
      readonly align?: NonNullable<LayoutOp["align"]>
    }
  | {
      readonly mode: "grid"
      readonly columns?: number
      readonly align?: NonNullable<LayoutOp["align"]>
    }

/**
 * A value per breakpoint, each applying from that breakpoint up, in
 * breakpoint order. A breakpoint that isn't set keeps the developer's own
 * value, so the mobile layout only changes when an op targets it (spec 5.6).
 */
type ByBreakpoint<T> = Readonly<Partial<Record<Breakpoint, T>>>

const collapseKinds = ["more", "accordion", "tabs"] as const

interface RegionEntryBase {
  /** The node's identity: the slot key, or the id an op created it with. */
  readonly id: string
  /**
   * Whether the node shows. A hidden node keeps its place, and is rendered
   * hidden (React `Activity`) so it keeps its state.
   */
  readonly visible: boolean
  /**
   * The node's pin. `"start"` and `"end"` place it; `"sticky"` keeps its
   * place in the order and only asks the renderer to keep it in view.
   */
  readonly pinned?: "start" | "end" | "sticky"
  /**
   * Set when a `collapse` on this container holds the node: render it inside
   * the container's "more" menu, accordion or tabs, under `label`.
   */
  readonly collapsed?: {
    readonly into: (typeof collapseKinds)[number]
    readonly label?: string
  }
  /** The node's column span in its container's grid, per breakpoint. */
  readonly span?: ByBreakpoint<number>
}

/**
 * A node the region renders, in a host wrapper keyed by `id`:
 * - `slot`: a developer's slot, rendered from the slots object it was
 *   declared in, which may be another region's when it moved in;
 * - `inserted`: a node an `insert` created, rendered from `node`;
 * - `wrapper`: a layout node a `wrap` created, holding its own `entries`,
 *   resolved like the region's and laid out by `layout`.
 */
export type RegionEntry =
  | (RegionEntryBase & { readonly kind: "slot" })
  | (RegionEntryBase & {
      readonly kind: "inserted"
      readonly node: InsertOp["node"]
    })
  | (RegionEntryBase & {
      readonly kind: "wrapper"
      readonly layout: ByBreakpoint<RegionLayout>
      readonly entries: readonly RegionEntry[]
    })

/** What a region renders, from `resolveRegion`. */
export interface ResolvedRegion {
  /** The region's layout per breakpoint, from `setLayout`. */
  readonly layout: ByBreakpoint<RegionLayout>
  /** The nodes in the region, in render order, hidden ones included. */
  readonly entries: readonly RegionEntry[]
}

/** The region `resolveRegion` resolves. */
export interface ResolveRegionOptions {
  /** The region's node id. */
  readonly id: string
  /** The region's slot ids in base order: its slots object's key order. */
  readonly slots: readonly string[]
}

interface SurfaceIndex {
  // Live nodes an insert or wrap created, by id.
  readonly created: ReadonlyMap<string, InsertOp | WrapOp>
  // Container to the nodes an op placed or created in it, sorted by id.
  readonly contents: ReadonlyMap<string, readonly string[]>
}

const indexes = new WeakMap<ResolvedLayers, SurfaceIndex>()

function creatingOp(
  layers: ResolvedLayers,
  id: string
): InsertOp | WrapOp | undefined {
  const op = layers.properties.get(id)?.get("inserted")?.winner.check.op
  return op?.op === "insert" || op?.op === "wrap" ? op : undefined
}

function indexOf(layers: ResolvedLayers): SurfaceIndex {
  const cached = indexes.get(layers)
  if (cached) {
    return cached
  }
  const created = new Map<string, InsertOp | WrapOp>()
  const contents = new Map<string, string[]>()
  const add = (container: string, id: string) => {
    const list = contents.get(container)
    if (list) {
      list.push(id)
    } else {
      contents.set(container, [id])
    }
  }
  for (const id of layers.properties.keys()) {
    const op = creatingOp(layers, id)
    if (op) {
      created.set(id, op)
      add(layers.placements.get(id)?.container ?? identityOf(op.target), id)
    }
  }
  for (const [id, { container }] of layers.placements) {
    // Item addresses in other collections contain a "/", and a removed node
    // still has the placement it had.
    if (
      !id.includes("/") &&
      !created.has(id) &&
      !layers.properties.get(id)?.has("inserted")
    ) {
      add(container, id)
    }
  }
  for (const list of contents.values()) {
    list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  }
  const index = { created, contents }
  indexes.set(layers, index)
  return index
}

function layoutOf(op: LayoutOp): RegionLayout {
  const align = op.align && { align: op.align }
  return op.mode === "grid"
    ? {
        mode: op.mode,
        ...(op.columns !== undefined && { columns: op.columns }),
        ...align,
      }
    : { mode: op.mode, ...align }
}

function byBreakpoint<T>(
  read: (breakpoint: Breakpoint) => T | undefined
): ByBreakpoint<T> {
  const values: Partial<Record<Breakpoint, T>> = {}
  for (const breakpoint of breakpointSchema.options) {
    const value = read(breakpoint)
    if (value !== undefined) {
      values[breakpoint] = value
    }
  }
  return values
}

/**
 * Resolves what a region renders from the resolved layers: the region's
 * layout, and its nodes in order, each with its visibility, pin, collapse and
 * span. A wrapper's nodes resolve the same way, inside it, with its wrap's
 * `items` as its base order.
 *
 * A region holds its slots, minus those an op placed in another node, plus
 * the nodes an op moved, wrapped or inserted into it. A removed node is
 * gone; a removed wrapper's nodes are back where they were before it.
 *
 * The order starts from the rank order: the base order, then the other nodes
 * by id. Base nodes placed in another node stay in it, unrendered, like
 * hidden nodes, so anchors resolve against the full order (spec 5.4, rule 2)
 * and indexes count them. Each node's position is its placement in this
 * container (wrap membership is the base order, not a position), or else,
 * in the node it was created in, an inserted node's insert `at` and a
 * wrapper's place right before its first item in the base order. An anchor
 * that isn't in the order, or is the node itself, and a position that keeps
 * the node in place (`pin sticky`, `pin none`), are passed over for the next
 * of these. Then the order follows the rules of the core's item order,
 * shared with tables:
 *
 * - `move before` or `after` puts a node next to its anchor, and it travels
 *   with it; nodes on the same anchor keep their rank order. A cycle of
 *   anchors leaves its nodes in place.
 * - `pin start` and `pin end` put a node first or last, in rank order.
 *   `pin sticky` keeps its place and is returned as `pinned` for the
 *   renderer; `pin none` keeps its place.
 * - `move index` puts a node at that index among the unpinned nodes, or
 *   right after the node placed at a lower index; ties keep rank order.
 * - Every other node keeps its place in the rank order.
 *
 * The result is plain data. It costs time linear in the region's size, after
 * sorting nodes that have an index; the first call for a `ResolvedLayers`
 * also indexes it once, in time linear in its size.
 *
 * Resolve the layers with the surface's known node ids: `@pliantui/react`
 * passes the ids mounted now, as `baseIds: { ids, source: "mounted" }`, so
 * ops into a region that isn't mounted wait for it instead of failing.
 */
export function resolveRegion(
  layers: ResolvedLayers,
  { id, slots }: ResolveRegionOptions
): ResolvedRegion {
  const index = indexOf(layers)
  const ancestors = new Set([id])

  // Where a node sits when no op placed it: a created node where it was
  // created, a base node in the container that lists it. A removed node is
  // nowhere.
  const containerOf = (node: string, base: string): string | undefined => {
    const placed = layers.placements.get(node)?.container
    if (placed !== undefined) {
      return placed
    }
    const op = index.created.get(node)
    if (op) {
      return identityOf(op.target)
    }
    return layers.properties.get(node)?.has("inserted") ? undefined : base
  }

  const resolveContainer = (
    container: string,
    base: readonly string[]
  ): RegionEntry[] => {
    const inBase = new Map<string, number>()
    for (const slot of base) {
      if (!inBase.has(slot)) {
        inBase.set(slot, inBase.size)
      }
    }
    const members = [
      ...[...inBase.keys()].filter(
        (slot) =>
          !ancestors.has(slot) && containerOf(slot, container) === container
      ),
      ...(index.contents.get(container) ?? []).filter(
        (member) => !inBase.has(member) && !ancestors.has(member)
      ),
    ]

    // Base nodes placed in another node stay in the order as anchors, so
    // moving one out never breaks another node's move.
    const items = [
      ...inBase.keys(),
      ...members.filter((member) => !inBase.has(member)),
    ]
    const known = new Set(items)
    const isMember = new Set(members)
    // A position that keeps the node in place gives way to its natural one.
    const applies = (member: string, position: PlacementPosition) => {
      if ("pin" in position) {
        return position.pin === "start" || position.pin === "end"
      }
      if ("promoted" in position) {
        return false
      }
      const anchor =
        "before" in position
          ? position.before
          : "after" in position
            ? position.after
            : undefined
      return anchor === undefined || (anchor !== member && known.has(anchor))
    }

    const naturalPosition = (member: string): PlacementPosition | undefined => {
      const op = index.created.get(member)
      if (inBase.has(member) || !op || identityOf(op.target) !== container) {
        return undefined
      }
      if (op.op === "insert") {
        return op.at
      }
      const first = op.items
        .filter((item) => inBase.has(item))
        .sort((a, b) => (inBase.get(a) ?? 0) - (inBase.get(b) ?? 0))[0]
      return first === undefined ? undefined : { before: first }
    }

    const order = orderItems(items, (member) => {
      if (!isMember.has(member)) {
        return undefined
      }
      const placement = layers.placements.get(member)
      // Wrap membership is the wrapper's base order, not a move.
      const explicit =
        placement?.container === container &&
        placement.winner?.check.op.op !== "wrap"
          ? placement.position
          : undefined
      const natural = naturalPosition(member)
      return [explicit, natural].find(
        (position) => position !== undefined && applies(member, position)
      )
    }).filter((member) => isMember.has(member))

    return order.map((member) => {
      const properties = layers.properties.get(member)
      const position = layers.placements.get(member)?.position
      const pin =
        position && "pin" in position && position.pin !== "none"
          ? position.pin
          : undefined
      const collapse = layers.properties
        .get(container)
        ?.get(`collapse.${member}`)?.winner.check.op
      const into =
        collapse?.op === "collapse"
          ? collapseKinds.find((kind) => kind === collapse.into)
          : undefined
      const span = properties?.get("span")?.breakpoints
      const entry: RegionEntryBase = {
        id: member,
        visible: properties?.get("visible")?.winner.check.op.op !== "hide",
        ...(pin && { pinned: pin }),
        ...(into && {
          collapsed: {
            into,
            ...(collapse?.op === "collapse" &&
              collapse.label !== undefined && { label: collapse.label }),
          },
        }),
        ...(span && {
          span: byBreakpoint((breakpoint) => {
            const op = span.get(breakpoint)?.check.op
            return op?.op === "span" ? op.columns : undefined
          }),
        }),
      }
      const op = index.created.get(member)
      if (op?.op === "insert") {
        return { ...entry, kind: "inserted", node: op.node }
      }
      if (op?.op === "wrap") {
        ancestors.add(member)
        const entries = resolveContainer(member, op.items)
        ancestors.delete(member)
        return {
          ...entry,
          kind: "wrapper",
          layout: layoutAt(member, op),
          entries,
        }
      }
      return { ...entry, kind: "slot" }
    })
  }

  // A wrap's own layout has no breakpoint, so like a `setLayout` without
  // `at` it applies from md up.
  const layoutAt = (
    node: string,
    wrap?: WrapOp
  ): ByBreakpoint<RegionLayout> => {
    const layouts = layers.properties.get(node)?.get("layout")?.breakpoints
    return byBreakpoint((breakpoint) => {
      const op = layouts?.get(breakpoint)?.check.op
      if (op?.op === "setLayout") {
        return layoutOf(op)
      }
      return wrap && breakpoint === "md" ? layoutOf(wrap) : undefined
    })
  }

  return { layout: layoutAt(id), entries: resolveContainer(id, slots) }
}
