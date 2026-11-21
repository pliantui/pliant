import { createHash } from "node:crypto"

import { builtInKinds, type ScannedSurface } from "./scanned-surface"

/** One surface's inventory, in the shape core's options take. */
export interface SurfaceInventory {
  readonly baseIds: {
    readonly ids: readonly string[]
    readonly source: "inventory" | "mounted"
  }
  readonly baseParents: Readonly<Record<string, string | null>>
  /** Each node's child nodes, in the order they render. */
  readonly baseOrder: Readonly<Record<string, readonly string[]>>
  /**
   * What each id is: its kind, and a hash of its kind and manifest, which
   * changes when either does.
   */
  readonly ids: Readonly<Record<string, { kind: string; hash: string }>>
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${stableJson(Reflect.get(value, key))}`
      )
      .join(",")}}`
  }
  return JSON.stringify(value)
}

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The surfaces' inventories, by surface. Ids are sorted, so the output
 * doesn't change with the order files are read in. A surface the scan
 * couldn't read in full lists its ids as `mounted`: a node it missed may
 * still exist, so an op into an unlisted node is dormant, not dropped.
 */
export function buildInventory(
  surfaces: readonly ScannedSurface[]
): Record<string, SurfaceInventory> {
  const inventory: Record<string, SurfaceInventory> = {}
  for (const surface of [...surfaces].sort((a, b) =>
    byCodePoint(a.surface, b.surface)
  )) {
    const nodes = [...surface.nodes.values()].sort((a, b) =>
      byCodePoint(a.id, b.id)
    )
    const baseParents: Record<string, string | null> = {}
    const ids: Record<string, { kind: string; hash: string }> = {}
    for (const node of nodes) {
      // Columns are items: their table is in their address.
      if (node.parent !== undefined && !node.id.includes("/")) {
        baseParents[node.id] = node.parent
      }
      const { kind, manifest } = node.own ??
        node.content ?? { kind: builtInKinds.slot }
      ids[node.id] = {
        kind,
        hash: createHash("sha256")
          .update(stableJson([kind, manifest ?? null]))
          .digest("hex")
          .slice(0, 16),
      }
    }
    // Nodes are recorded as the scan reaches them, which is render order.
    // Like `baseParents`, it names only nodes whose parent is known.
    const children = new Map<string, string[]>()
    for (const node of surface.nodes.values()) {
      if (
        typeof node.parent === "string" &&
        !node.id.includes("/") &&
        surface.nodes.get(node.parent)?.parent !== undefined
      ) {
        children.set(node.parent, [
          ...(children.get(node.parent) ?? []),
          node.id,
        ])
      }
    }
    const baseOrder = Object.fromEntries(
      [...children].sort(([a], [b]) => byCodePoint(a, b))
    )
    inventory[surface.surface] = {
      baseIds: {
        ids: nodes.map((node) => node.id),
        source: surface.incomplete ? "mounted" : "inventory",
      },
      baseParents,
      baseOrder,
      ids,
    }
  }
  return inventory
}
