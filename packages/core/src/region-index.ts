import type { Op } from "@pliantui/contract"

import { compareOrdered } from "./compare-ordered"
import { identityOf } from "./node-identity"
import { placementOf, type PlacementPosition } from "./placement"
import type { ResolvedLayers, ResolvedOp } from "./resolve-layers"

export type CreatingOp = Extract<Op, { op: "insert" | "wrap" }>

/** A node an `insert` or `wrap` created, and whether it is still there. */
export interface Creation {
  readonly op: CreatingOp
  readonly live: boolean
}

/** The resolved layers indexed by container, for resolving regions. */
export interface RegionIndex {
  /** The surface's known node ids the layers resolved with, if any. */
  readonly known: ReadonlySet<string> | undefined
  /** Every node an op created, live or removed, by id. */
  readonly creations: ReadonlyMap<string, Creation>
  /**
   * Container to the live nodes an op placed or created in it, by id. A base
   * node no op placed isn't listed: only its container knows it.
   */
  readonly contents: ReadonlyMap<string, readonly string[]>
  /**
   * Container to every node an op ever created or placed in it, with the
   * node's latest position there: absent after it was created, moved in or
   * wrapped, which keeps its own place.
   */
  readonly traces: ReadonlyMap<
    string,
    ReadonlyMap<string, PlacementPosition | undefined>
  >
}

function creatingOp(op: Op): CreatingOp | undefined {
  return op.op === "insert" || op.op === "wrap" ? op : undefined
}

function creationOf(layers: ResolvedLayers, id: string): Creation | undefined {
  const inserted = layers.properties.get(id)?.get("inserted")
  if (!inserted) {
    return undefined
  }
  const live = creatingOp(inserted.winner.check.op)
  if (live) {
    return { op: live, live: true }
  }
  const op = inserted.overridden
    .map(({ check }) => creatingOp(check.op))
    .findLast((candidate) => candidate !== undefined)
  return op && { op, live: false }
}

function listIn<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) {
    list.push(value)
  } else {
    map.set(key, [value])
  }
}

// Every lookup of a `ResolvedLayers` reuses its index, so the layers must
// not change after they are resolved; a copy is indexed again.
const indexes = new WeakMap<ResolvedLayers, RegionIndex>()

/**
 * Indexes the layers once, in time linear in their size, apart from sorting
 * each node's placement ops back into the order they applied in.
 */
export function regionIndexOf(layers: ResolvedLayers): RegionIndex {
  const cached = indexes.get(layers)
  if (cached) {
    return cached
  }
  const rank = new Map(
    layers.overlays.map((overlay, index) => [overlay, index])
  )
  const applied = (a: ResolvedOp, b: ResolvedOp) =>
    (rank.get(a.overlay) ?? 0) - (rank.get(b.overlay) ?? 0) ||
    a.check.index - b.check.index
  const creations = new Map<string, Creation>()
  const contents = new Map<string, string[]>()
  const traces = new Map<string, Map<string, PlacementPosition | undefined>>()
  const trace = (
    container: string,
    id: string,
    position: PlacementPosition | undefined
  ) => {
    let items = traces.get(container)
    if (!items) {
      items = new Map()
      traces.set(container, items)
    }
    items.set(id, position)
  }

  for (const id of layers.properties.keys()) {
    const creation = creationOf(layers, id)
    if (creation) {
      creations.set(id, creation)
      trace(identityOf(creation.op.target), id, undefined)
      if (creation.live) {
        listIn(
          contents,
          layers.placements.get(id)?.container ??
            identityOf(creation.op.target),
          id
        )
      }
    }
  }
  for (const [id, { container, winner, overridden }] of layers.placements) {
    // Items in other collections have a "/" in their identity.
    if (id.includes("/")) {
      continue
    }
    let current = creations.get(id)?.op.target
    const history = winner ? [...overridden, winner] : [...overridden]
    for (const { check } of history.sort(applied)) {
      const placement = placementOf(
        check.op,
        id,
        current === undefined ? undefined : identityOf(current)
      )
      if (placement) {
        current = placement.container
        trace(
          current,
          id,
          check.op.op === "wrap" ? undefined : placement.position
        )
      }
    }
    if (!creations.has(id)) {
      listIn(contents, container, id)
    }
  }
  for (const list of contents.values()) {
    list.sort(compareOrdered)
  }
  const index = {
    known: layers.baseIds && new Set(layers.baseIds.ids),
    creations,
    contents,
    traces,
  }
  indexes.set(layers, index)
  return index
}
