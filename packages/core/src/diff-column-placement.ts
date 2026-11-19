import type { Op } from "@pliantui/contract"

import { compareData } from "./compare-data"
import type {
  CompiledTableState,
  CompileTableStateOptions,
} from "./compile-table-state"
import { identityOf } from "./node-identity"
import type { PlacementPosition } from "./placement"
import type { ResolvedLayers } from "./resolve-layers"
import { columnPositions, layoutColumns } from "./table-columns"

type Side = "start" | "end" | "none"

// How many columns away a column moved alone may anchor.
const reach = 4

// How many columns a single move may leave out of place and still be
// anchored one by one.
const settleLimit = 2

// How many columns the search for a smaller fix may lay out, over all the
// orders it compiles: about 100 orders of a 32-column table.
const tryBudget = 3200

// Up to how many columns every column is tried as the one to move.
const smallTable = 32

type Reorder =
  | { readonly before: string }
  | { readonly after: string }
  | { readonly index: number }

function sideOf(
  pinning: CompiledTableState["columnPinning"],
  column: string
): Side {
  return pinning.start.includes(column)
    ? "start"
    : pinning.end.includes(column)
      ? "end"
      : "none"
}

function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

// How many of `items` are in `wanted`'s order, in O(n log n).
function inOrderCount(items: readonly string[], wanted: readonly string[]) {
  const place = new Map(wanted.map((item, index) => [item, index]))
  const tails: number[] = []
  for (const item of items) {
    const at = place.get(item) ?? -1
    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if ((tails[middle] ?? 0) < at) {
        low = middle + 1
      } else {
        high = middle
      }
    }
    tails[low] = at
  }
  return tails.length
}

// The items already in `wanted`'s order: a heaviest increasing
// subsequence of their places in it. Every item weighs more than all the
// `extra` weights together, so it is a longest one, and among those it
// keeps the items with the most `extra`.
function inOrder(
  items: readonly string[],
  wanted: readonly string[],
  extra: (item: string) => number = () => 0
) {
  const place = new Map(wanted.map((item, index) => [item, index]))
  const places = items.map((item) => place.get(item) ?? -1)
  const unit = 1 + items.reduce((total, item) => total + extra(item), 0)
  const totals: number[] = []
  const links: number[] = []
  places.forEach((at, index) => {
    let best = -1
    for (let before = 0; before < index; before++) {
      if (
        (places[before] ?? 0) < at &&
        (best < 0 || (totals[before] ?? 0) > (totals[best] ?? 0))
      ) {
        best = before
      }
    }
    totals[index] =
      unit + extra(items[index] ?? "") + (best < 0 ? 0 : (totals[best] ?? 0))
    links[index] = best
  })
  let last = -1
  totals.forEach((total, index) => {
    if (last < 0 || total > (totals[last] ?? 0)) {
      last = index
    }
  })
  const kept = new Set<string>()
  for (let index = last; index >= 0; index = links[index] ?? -1) {
    kept.add(items[index] ?? "")
  }
  return kept
}

/**
 * The `pin` and `move` ops, by column, that give the table `next`'s pinning
 * and unpinned order; see `diffTableState`.
 *
 * The columns already in order (a longest increasing subsequence) stay;
 * every other one is anchored on its new neighbour, and the result is
 * compiled the way `compileTableState` does to check it, adding the columns
 * that end up out of place (such as ones a lower layer anchored on a moved
 * column, which travel with it) until it holds, then dropping the moves it
 * holds without. When that takes more than one move, a capped search tries
 * moving a single column with a farther anchor instead. Chaining the
 * columns out of place is the last resort. Each check costs one layout of
 * the table, and their number stays close to linear in the moves needed.
 */
export function placementOps(
  { placements }: Pick<ResolvedLayers, "placements">,
  next: Partial<CompiledTableState>,
  previous: CompiledTableState,
  { table, columns, base = {} }: CompileTableStateOptions
) {
  const ops = new Map<string, Op>()
  const ids = [...new Set(columns)]
  const known = new Set(ids)
  const target = (column: string) => `${table}/columns/${column}`
  const positions = columnPositions(placements, identityOf(table), ids)
  const pinning = next.columnPinning ?? previous.columnPinning

  for (const column of ids) {
    const side = sideOf(pinning, column)
    if (sideOf(previous.columnPinning, column) !== side) {
      positions.set(column, { pin: side })
      ops.set(column, { op: "pin", target: target(column), where: side })
    }
  }

  const reordered =
    next.columnOrder !== undefined &&
    compareData(next.columnOrder, previous.columnOrder) !== 0
  if (ops.size === 0 && !reordered) {
    return ops
  }
  // Without a new order, the unpinned columns keep the order the table
  // showed, as TanStack keeps it when a column is pinned or unpinned.
  const center = new Set(ids.filter((id) => sideOf(pinning, id) === "none"))
  const wanted = [
    ...new Set([
      ...((reordered ? next.columnOrder : undefined) ?? previous.columnOrder),
      ...ids,
    ]),
  ].filter((id) => known.has(id) && center.has(id))
  const basePinned = new Set([
    ...(base.columnPinning?.start ?? []),
    ...(base.columnPinning?.end ?? []),
  ])
  // A column the base pins is unpinned by its `pin none` position, which a
  // move would replace, pinning it again.
  const fixed = (column: string) => basePinned.has(column)
  const orderOf = (moves: ReadonlyMap<string, Reorder>) =>
    layoutColumns(
      ids,
      base,
      (column) => moves.get(column) ?? positions.get(column)
    ).columnOrder.filter((id) => center.has(id))

  const anchorOf = (position: PlacementPosition | undefined) =>
    position && "before" in position
      ? position.before
      : position && "after" in position
        ? position.after
        : undefined
  const place = new Map(wanted.map((column, index) => [column, index]))
  const isAnchored = (
    moves: ReadonlyMap<string, Reorder>,
    column: string,
    on: string
  ) => {
    const seen = new Set<string>()
    for (
      let current: string | undefined = on;
      current !== undefined && !seen.has(current);
      current = anchorOf(moves.get(current) ?? positions.get(current))
    ) {
      if (current === column) {
        return true
      }
      seen.add(current)
    }
    return false
  }
  // Anchors each run of moved columns on the kept column before it, or,
  // when another column already sits after that one (columns anchored on
  // the same one sort by base order), before the kept column after it. An
  // anchor whose own anchors lead back to the column would be a cycle, so
  // such a column takes its index instead.
  const anchorsFor = (moved: ReadonlySet<string>, flip: boolean) => {
    const moves = new Map<string, Reorder>()
    const taken = new Set<string>()
    for (const [column, position] of positions) {
      if (!moved.has(column) && position) {
        if ("after" in position) {
          taken.add(`after:${position.after}`)
        } else if ("before" in position) {
          taken.add(`before:${position.before}`)
        }
      }
    }
    let start = 0
    while (start < wanted.length) {
      if (!moved.has(wanted[start] ?? "")) {
        start++
        continue
      }
      let end = start
      while (end + 1 < wanted.length && moved.has(wanted[end + 1] ?? "")) {
        end++
      }
      const before = wanted[start - 1]
      const after = wanted[end + 1]
      const run = wanted.slice(start, end + 1)
      const preferBackward =
        before === undefined ||
        (after !== undefined &&
          (flip
            ? !taken.has(`before:${after}`)
            : taken.has(`after:${before}`) && !taken.has(`before:${after}`)))
      // The run hangs off its edge column, which anchors on the kept column
      // beside the run: on the other side when that one's anchors lead back
      // into the run, else at its index.
      const edgeOf = (backward: boolean): Reorder | undefined => {
        const edge = backward ? run.at(-1) : run[0]
        const neighbour = backward ? after : before
        return edge === undefined ||
          neighbour === undefined ||
          run.some((column) => isAnchored(moves, column, neighbour))
          ? undefined
          : backward
            ? { before: neighbour }
            : { after: neighbour }
      }
      const backward =
        edgeOf(preferBackward) === undefined && edgeOf(!preferBackward)
          ? !preferBackward
          : preferBackward
      const ordered = backward ? run.toReversed() : run
      ordered.forEach((column, index) => {
        const neighbour = ordered[index - 1]
        moves.set(
          column,
          neighbour !== undefined
            ? backward
              ? { before: neighbour }
              : { after: neighbour }
            : (edgeOf(backward) ?? { index: place.get(column) ?? 0 })
        )
      })
      start = end + 1
    }
    return moves
  }

  // Keeps the columns already in order and anchors the rest on their new
  // neighbours. Columns a lower layer anchored on a moved column would
  // travel with it, so they are anchored too; columns still out of place
  // after compiling are added until the order holds. A last pass drops
  // the moves the order holds without.
  const misplaced = (trial: ReadonlyMap<string, Reorder>) => {
    const order = orderOf(trial)
    return order.length - inOrderCount(order, wanted)
  }
  const optionsOf = (column: string): Reorder[] => {
    const index = place.get(column) ?? 0
    const options: Reorder[] = []
    for (let distance = 1; distance <= reach; distance++) {
      const before = wanted[index - distance]
      const after = wanted[index + distance]
      if (before !== undefined) {
        options.push({ after: before })
      }
      if (after !== undefined) {
        options.push({ before: after })
      }
    }
    return [...options, { index }]
  }
  const dependants = new Map<string, number>()
  for (const position of positions.values()) {
    const anchor = anchorOf(position)
    if (anchor !== undefined) {
      dependants.set(anchor, (dependants.get(anchor) ?? 0) + 1)
    }
  }
  // Columns others are anchored on are kept first, so they don't move the
  // columns riding on them, and columns placed by index last, since their
  // place shifts whenever a column before them moves.
  const extraOf = (column: string) => {
    const position = positions.get(column)
    return (
      2 * (dependants.get(column) ?? 0) +
      (position && "index" in position ? 0 : 1)
    )
  }
  const current = orderOf(new Map())
  const kept = inOrder(current, wanted, extraOf)
  const dragged = new Set(
    wanted.filter((column) => !kept.has(column) && !fixed(column))
  )
  const riders = [...positions].flatMap(([column, position]) => {
    const anchor = anchorOf(position)
    return anchor !== undefined &&
      dragged.has(anchor) &&
      center.has(column) &&
      !fixed(column)
      ? [column]
      : []
  })
  const search = (withRiders: boolean, flip: boolean) => {
    const moved = new Set([...dragged, ...(withRiders ? riders : [])])
    let moves = anchorsFor(moved, flip)
    for (;;) {
      const order = orderOf(moves)
      if (sameOrder(order, wanted)) {
        break
      }
      const settled = inOrder(order, wanted)
      const added = order.filter(
        (column) => !settled.has(column) && !moved.has(column) && !fixed(column)
      )
      if (added.length === 0) {
        return undefined
      }
      for (const column of added) {
        moved.add(column)
      }
      moves = anchorsFor(moved, flip)
    }
    if (moves.size > dragged.size) {
      for (const column of [...moves.keys()]) {
        const without = new Map(moves)
        without.delete(column)
        if (sameOrder(orderOf(without), wanted)) {
          moves = without
        }
      }
    }
    return moves
  }
  // A few variants are tried when the first needs more moves than the
  // columns out of order: anchoring the riders up front or only once they
  // end up out of place, and preferring either side of each run.
  let found = search(true, false)
  for (const [withRiders, flip] of [
    [false, false],
    [true, true],
    [false, true],
  ] as const) {
    if (found && found.size <= dragged.size) {
      break
    }
    const other = search(withRiders, flip)
    if (other && (!found || other.size < found.size)) {
      found = other
    }
  }
  let moves = found ?? new Map<string, Reorder>()

  // A drag of one column (with the columns riding on it) can often be
  // matched by moving that column alone, anchored further away, then
  // anchoring the few columns that end up out of place, such as ones placed
  // by index. Tried when the search needs more than one move.
  const children = new Map<string, string[]>()
  for (const [column, position] of positions) {
    const anchor = anchorOf(position)
    if (anchor !== undefined) {
      children.set(anchor, [...(children.get(anchor) ?? []), column])
    }
  }
  const subtreeOf = (column: string) => {
    const subtree = new Set([column])
    for (const member of subtree) {
      for (const child of children.get(member) ?? []) {
        subtree.add(child)
      }
    }
    return subtree
  }
  // Each try compiles the order, so the tries are capped to keep a drag on
  // a wide table within a frame.
  let budget = Math.floor(tryBudget / Math.max(wanted.length, 1))
  const verified = (trial: ReadonlyMap<string, Reorder>) => {
    budget--
    return sameOrder(orderOf(trial), wanted)
  }
  let settled = found !== undefined && verified(found)
  const done = () => settled && moves.size === 1
  if (!done()) {
    for (const column of wanted) {
      if (budget <= 0 || done() || fixed(column)) {
        continue
      }
      const subtree = subtreeOf(column)
      const alone = sameOrder(
        current.filter((other) => !subtree.has(other)),
        wanted.filter((other) => !subtree.has(other))
      )
      // On small tables, any column may be the one to move, since moving
      // one shifts the columns placed by index after it.
      if (!alone && wanted.length > smallTable) {
        continue
      }
      for (const to of optionsOf(column)) {
        let trial = new Map<string, Reorder>().set(column, to)
        for (let round = 0; alone && round < 6 && !verified(trial); round++) {
          const order = orderOf(trial)
          const settled = inOrder(order, wanted, extraOf)
          const misplacedColumns = order.filter(
            (other) => !settled.has(other) && !trial.has(other) && !fixed(other)
          )
          // A move that puts many columns out of place isn't a small fix.
          if (misplacedColumns.length > settleLimit) {
            break
          }
          for (const other of budget > 0 ? misplacedColumns : []) {
            trial = optionsOf(other)
              .map((option) => new Map(trial).set(other, option))
              .reduce((best, next) => {
                budget--
                return misplaced(next) < misplaced(best) ? next : best
              })
          }
        }
        if (verified(trial) && (!settled || trial.size < moves.size)) {
          moves = trial
          settled = true
        }
      }
    }
  }

  // Otherwise the columns from the first to the last out of place are
  // chained, each after the one before it, widening the range until it
  // holds; chaining every column always does.
  if (!sameOrder(orderOf(moves), wanted)) {
    const current = orderOf(new Map())
    let low = wanted.findIndex((column, index) => current[index] !== column)
    let high = wanted.findLastIndex(
      (column, index) => current[index] !== column
    )
    for (;;) {
      moves = new Map(
        wanted
          .slice(low, high + 1)
          .filter((column) => !fixed(column))
          .map((column) => {
            const before = wanted[wanted.indexOf(column) - 1]
            const to: Reorder =
              before === undefined ? { index: 0 } : { after: before }
            return [column, to]
          })
      )
      if (
        sameOrder(orderOf(moves), wanted) ||
        (low === 0 && high === wanted.length - 1)
      ) {
        break
      }
      low = Math.max(0, low - 1)
      high = Math.min(wanted.length - 1, high + 1)
    }
  }
  for (const [column, to] of moves) {
    ops.set(column, { op: "move", target: target(column), to })
  }
  return ops
}
