import type { PlacementPosition } from "./placement"

interface Anchored {
  readonly before: string[]
  readonly after: string[]
}

function anchorOf(
  item: string,
  position: PlacementPosition | undefined,
  known: ReadonlySet<string>
): string | undefined {
  const anchor =
    position && "before" in position
      ? position.before
      : position && "after" in position
        ? position.after
        : undefined
  return anchor !== undefined && anchor !== item && known.has(anchor)
    ? anchor
    : undefined
}

// Items whose anchors form a cycle (a after b, b after a) can't be placed
// relative to each other, so their anchors are dropped.
function dropCycles(items: readonly string[], anchors: Map<string, string>) {
  const done = new Set<string>()
  for (const item of items) {
    const path: string[] = []
    const onPath = new Set<string>()
    let current: string | undefined = item
    while (
      current !== undefined &&
      !done.has(current) &&
      !onPath.has(current)
    ) {
      path.push(current)
      onPath.add(current)
      current = anchors.get(current)
    }
    if (current !== undefined && onPath.has(current)) {
      for (const member of path.slice(path.indexOf(current))) {
        anchors.delete(member)
      }
    }
    for (const visited of path) {
      done.add(visited)
    }
  }
}

function expand(root: string, anchored: Map<string, Anchored>): string[] {
  const order: string[] = []
  const stack: { readonly item: string; readonly expanded: boolean }[] = [
    { item: root, expanded: false },
  ]
  for (let next = stack.pop(); next; next = stack.pop()) {
    const { item, expanded } = next
    const children = anchored.get(item)
    if (expanded || !children) {
      order.push(item)
      continue
    }
    for (const after of children.after.toReversed()) {
      stack.push({ item: after, expanded: false })
    }
    stack.push({ item, expanded: true })
    for (const before of children.before.toReversed()) {
      stack.push({ item: before, expanded: false })
    }
  }
  return order
}

export interface OrderItemsOptions {
  /**
   * Whether an item is rendered; every item is when omitted. An item that
   * isn't, such as one placed in another container since, still keeps its
   * place and resolves anchors, but takes no index and is left out of the
   * result.
   */
  readonly renders?: ((item: string) => boolean) | undefined
}

/**
 * Orders a container's items from their resolved positions (see
 * `ResolvedPlacement.position`). `items` is the container's own order,
 * including hidden items, so anchors resolve against the full order and
 * hiding an item never breaks another item's move.
 *
 * - An item `before` or `after` another goes next to it, and travels with
 *   it. Items anchored on the same item keep their order from `items`. An
 *   anchor that isn't in `items`, or a cycle of anchors, leaves the item in
 *   its own place.
 * - Items pinned `start` or `end` go first or last, in their order from
 *   `items`.
 * - An item at `{ index }` is placed at that index among the rendered
 *   unpinned items, or right after the item placed at a lower index, with
 *   the items anchored on it. Ties keep their order from `items`.
 * - Every other item (no position, `sticky`, `none`, `promoted`) keeps its
 *   place.
 *
 * `positionOf` is called once per item. Takes time linear in the number of
 * items, apart from sorting the indexed ones.
 */
export function orderItems(
  items: readonly string[],
  positionOf: (item: string) => PlacementPosition | undefined,
  { renders }: OrderItemsOptions = {}
): string[] {
  const unique = [...new Set(items)]
  const known = new Set(unique)
  const positions = new Map<string, PlacementPosition | undefined>()
  const anchors = new Map<string, string>()
  for (const item of unique) {
    const position = positionOf(item)
    positions.set(item, position)
    const anchor = anchorOf(item, position, known)
    if (anchor !== undefined) {
      anchors.set(item, anchor)
    }
  }
  dropCycles(unique, anchors)

  const anchored = new Map<string, Anchored>()
  const start: string[] = []
  const middle: string[] = []
  const end: string[] = []
  const indexed: { readonly item: string; readonly index: number }[] = []
  for (const item of unique) {
    const anchor = anchors.get(item)
    const position = positions.get(item)
    if (anchor !== undefined) {
      let children = anchored.get(anchor)
      if (!children) {
        children = { before: [], after: [] }
        anchored.set(anchor, children)
      }
      children[position && "before" in position ? "before" : "after"].push(item)
    } else if (position && "pin" in position && position.pin === "start") {
      start.push(item)
    } else if (position && "pin" in position && position.pin === "end") {
      end.push(item)
    } else if (position && "index" in position) {
      indexed.push({ item, index: position.index })
    } else {
      middle.push(item)
    }
  }

  const hidden = new Set(renders ? unique.filter((item) => !renders(item)) : [])
  const ordered: string[] = []
  // Rendered items placed among the unpinned ones, which indexes count.
  let placed = 0
  const append = (list: readonly string[]) => {
    for (const item of list) {
      if (!hidden.has(item)) {
        ordered.push(item)
        placed++
      }
    }
  }
  for (const item of start) {
    append(expand(item, anchored))
  }
  placed = 0
  const unpinned = middle.flatMap((item) => expand(item, anchored))
  let taken = 0
  for (const { item, index } of indexed.toSorted((a, b) => a.index - b.index)) {
    for (
      let next = unpinned[taken];
      next !== undefined && placed < index;
      next = unpinned[++taken]
    ) {
      append([next])
    }
    append(expand(item, anchored))
  }
  append(unpinned.slice(taken))
  for (const item of end) {
    append(expand(item, anchored))
  }
  return ordered
}
