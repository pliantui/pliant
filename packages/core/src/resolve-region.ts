import { breakpointSchema, type Breakpoint, type Op } from "@pliantui/contract"

import { compareOrdered } from "./compare-ordered"
import { identityOf } from "./node-identity"
import { orderItems } from "./order-items"
import type { PlacementPosition } from "./placement"
import { regionIndexOf, type CreatingOp } from "./region-index"
import type { ResolvedLayers } from "./resolve-layers"

type InsertOp = Extract<Op, { op: "insert" }>
type LayoutOp = Extract<Op, { op: "setLayout" | "wrap" }>

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
export type ByBreakpoint<T> = Readonly<Partial<Record<Breakpoint, T>>>

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
 * - `slot`: a developer's slot: one of the region's own `slots`, or a known
 *   node an op placed here from elsewhere, rendered from the slots object it
 *   was declared in;
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
      /**
       * The wrap's own layout from md up, as the wrapper's base, with each
       * breakpoint a `setLayout` sets on the wrapper over it. Unlike layers,
       * which replace a lower layer's whole map, a `setLayout` at lg keeps
       * the wrap's layout at md.
       */
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

interface Container {
  readonly id: string
  readonly base: readonly string[]
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

function anchorOf(position: PlacementPosition): string | undefined {
  return "before" in position
    ? position.before
    : "after" in position
      ? position.after
      : undefined
}

/**
 * Resolves what a region renders from the resolved layers: the region's
 * layout, and its nodes in order, each with its visibility, pin, collapse and
 * span. A wrapper's nodes resolve the same way, inside it, with its wrap's
 * `items` as its base order.
 *
 * A region holds its slots, minus those an op placed in another node, plus
 * the nodes an op moved, wrapped or inserted into it. A removed node is
 * gone; a removed wrapper's nodes are back where they were before it. When
 * the layers resolved with `baseIds`, a node other than the region's own
 * slots renders only when it is listed there or an op created it: one that
 * isn't doesn't exist or isn't mounted, so it only keeps its place as an
 * anchor. Without `baseIds`, every placed node renders.
 *
 * The order starts from the base order, then every other node by id. Nodes
 * that were in the container and left it (moved out, wrapped, removed) stay
 * in the order without rendering, at their latest position there, so
 * anchors on them keep working (spec 5.4, rule 2); like hidden nodes, but
 * unlike them they take no index. Each node's position is the first of
 * these that applies:
 *
 * 1. its placement in the container, then its latest position there before
 *    it left (wrap membership is the wrapper's base order, not a position);
 * 2. in the node it was created in, an inserted node's insert `at`, or a
 *    wrapper's place right before its first listed item that is in the
 *    order here. An item never shown here is in the order at its base place
 *    when it is one of the region's slots, so `move a into sidebar` then
 *    `wrap w [a, d]` puts the wrapper first;
 * 3. created in a node that was removed, its insert `at` when the anchor is
 *    here, else right after that node's place.
 *
 * An anchor that isn't in the order, or is the node itself, doesn't apply,
 * nor does a position that keeps the node in place (`pin sticky`, `pin
 * none`). An anchor on a removed inserted node keeps working from that
 * node's old place; spec 5.4 rule 3 may later flag such an op "needs
 * updating" instead. The order then follows `orderItems`, shared with tables:
 *
 * - `move before` or `after` puts a node next to its anchor, and it travels
 *   with it; nodes on the same anchor keep their order. A cycle of anchors
 *   leaves its nodes in place.
 * - `pin start` and `pin end` put a node first or last.
 * - `move index` puts a node at that index among the rendered unpinned
 *   nodes, or right after the node placed at a lower index.
 * - Every other node keeps its place, ties in the starting order.
 *
 * The result is plain data. Each region costs time linear in its size, apart
 * from sorting; the first call for a `ResolvedLayers` also indexes it once,
 * in time linear in its size. The index is cached on the layers object, so
 * the layers must not be mutated after they are resolved.
 */
export function resolveRegion(
  layers: ResolvedLayers,
  { id, slots }: ResolveRegionOptions
): ResolvedRegion {
  const { known, creations, contents, traces } = regionIndexOf(layers)
  const live = (node: string) => creations.get(node)?.live === true
  const seen = new Set([id])
  const regionSlots = new Set(slots)

  // Where a node sits when no op placed it: a created node where it was
  // created, a base node in the container that lists it. A removed node is
  // nowhere.
  const containerOf = (node: string, base: string): string | undefined => {
    const creation = creations.get(node)
    if (creation && !creation.live) {
      return undefined
    }
    return (
      layers.placements.get(node)?.container ??
      (creation ? identityOf(creation.op.target) : base)
    )
  }

  const layoutAt = (node: string, wrap?: CreatingOp) => {
    const layouts = layers.properties.get(node)?.get("layout")?.breakpoints
    return byBreakpoint((breakpoint) => {
      const op = layouts?.get(breakpoint)?.check.op
      if (op?.op === "setLayout") {
        return layoutOf(op)
      }
      return wrap?.op === "wrap" && breakpoint === "md"
        ? layoutOf(wrap)
        : undefined
    })
  }

  const orderOf = ({ id: container, base }: Container): string[] => {
    const inBase = new Set(base)
    const traced = traces.get(container)
    const others = new Set([
      ...(contents.get(container) ?? []),
      ...(traced?.keys() ?? []),
    ])
    const items = [
      ...inBase,
      ...[...others].filter((node) => !inBase.has(node)).sort(compareOrdered),
    ]
    const isItem = new Set(items)
    const renders = new Set(
      items.filter(
        (node) =>
          !seen.has(node) &&
          containerOf(node, container) === container &&
          (regionSlots.has(node) ||
            creations.has(node) ||
            known === undefined ||
            known.has(node))
      )
    )

    const applies = (node: string, position: PlacementPosition) => {
      if ("pin" in position) {
        return position.pin === "start" || position.pin === "end"
      }
      if ("promoted" in position) {
        return false
      }
      const anchor = anchorOf(position)
      return anchor === undefined || (anchor !== node && isItem.has(anchor))
    }

    const createdPosition = (node: string): PlacementPosition | undefined => {
      const op = creations.get(node)?.op
      if (!op || inBase.has(node)) {
        return undefined
      }
      const parent = identityOf(op.target)
      if (parent === container) {
        const first =
          op.op === "wrap" && op.items.find((item) => isItem.has(item))
        return op.op === "insert"
          ? op.at
          : first
            ? { before: first }
            : undefined
      }
      if (op.op === "insert" && anchorOf(op.at) !== undefined) {
        return op.at
      }
      return isItem.has(parent) ? { after: parent } : undefined
    }

    return orderItems(
      items,
      (node) => {
        const placement = layers.placements.get(node)
        const candidates = [
          placement?.container === container &&
          placement.winner?.check.op.op !== "wrap"
            ? placement.position
            : undefined,
          traced?.get(node),
          createdPosition(node),
        ]
        return candidates.find(
          (position) => position !== undefined && applies(node, position)
        )
      },
      { renders: (node) => renders.has(node) }
    )
  }

  // Walks wrappers with a stack, so deep nesting can't overflow it.
  const orders = new Map<string, string[]>()
  const visits: string[] = []
  const pending: Container[] = [{ id, base: slots }]
  for (let container = pending.pop(); container; container = pending.pop()) {
    const order = orderOf(container)
    for (const node of order) {
      seen.add(node)
    }
    orders.set(container.id, order)
    visits.push(container.id)
    for (const node of order) {
      const op = creations.get(node)?.op
      if (op?.op === "wrap" && live(node)) {
        pending.push({ id: node, base: op.items })
      }
    }
  }

  const built = new Map<string, RegionEntry[]>()
  for (const container of visits.toReversed()) {
    const collapses = layers.properties.get(container)
    built.set(
      container,
      (orders.get(container) ?? []).map((node): RegionEntry => {
        const properties = layers.properties.get(node)
        const position = layers.placements.get(node)?.position
        const pin =
          position && "pin" in position && position.pin !== "none"
            ? position.pin
            : undefined
        const collapseOp = collapses?.get(`collapse.${node}`)?.winner.check.op
        const collapse = collapseOp?.op === "collapse" ? collapseOp : undefined
        const into = collapseKinds.find((kind) => kind === collapse?.into)
        const span = properties?.get("span")?.breakpoints
        const entry: RegionEntryBase = {
          id: node,
          visible: properties?.get("visible")?.winner.check.op.op !== "hide",
          ...(pin && { pinned: pin }),
          ...(into && {
            collapsed: {
              into,
              ...(collapse?.label !== undefined && { label: collapse.label }),
            },
          }),
          ...(span && {
            span: byBreakpoint((breakpoint) => {
              const op = span.get(breakpoint)?.check.op
              return op?.op === "span" ? op.columns : undefined
            }),
          }),
        }
        const op = creations.get(node)?.op
        if (op?.op === "insert") {
          return { ...entry, kind: "inserted", node: op.node }
        }
        if (op?.op === "wrap") {
          return {
            ...entry,
            kind: "wrapper",
            layout: layoutAt(node, op),
            entries: built.get(node) ?? [],
          }
        }
        return { ...entry, kind: "slot" }
      })
    )
  }

  return { layout: layoutAt(id), entries: built.get(id) ?? [] }
}
