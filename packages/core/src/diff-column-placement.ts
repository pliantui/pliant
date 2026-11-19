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

// How many columns away a moved column may anchor.
const reach = 4

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

// How far `items` is from `wanted`'s order: the number of pairs in the
// other order. Unlike a count of misplaced items, it falls with each step
// towards `wanted`, so a greedy search doesn't stall.
function inversions(items: readonly string[], wanted: readonly string[]) {
  const place = new Map(wanted.map((item, index) => [item, index]))
  const places = items.map((item) => place.get(item) ?? -1)
  let count = 0
  places.forEach((at, index) => {
    for (const later of places.slice(index + 1)) {
      if (later < at) {
        count++
      }
    }
  })
  return count
}

/**
 * The `pin` and `move` ops, by column, that give the table `next`'s pinning
 * and unpinned order; see `diffTableState`.
 *
 * Moves are found greedily: each step compiles every candidate (a column
 * anchored after the column before it in `next`, or before the one after
 * it) the way `compileTableState` does, and keeps the one that leaves the
 * fewest columns out of order. Columns a lower layer anchored on a moved
 * column travel with it, so they are moved only when they end up out of
 * place. Chaining every movable column is the last resort.
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
  const misplaced = (moves: ReadonlyMap<string, Reorder>) =>
    inversions(orderOf(moves), wanted)
  // A column can follow any of the few columns before it in `wanted`, or
  // precede any of the few after it, nearest first: with the columns
  // anchored on it, it fills the gap between them.
  const optionsOf = (column: string): Reorder[] => {
    const index = wanted.indexOf(column)
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
    return index === 0 ? [...options, { index: 0 }] : options
  }

  // The best anchor for `column` on top of `moves`.
  const settle = (moves: Map<string, Reorder>, column: string) =>
    optionsOf(column)
      .map((to) => new Map(moves).set(column, to))
      .reduce((best, trial) =>
        misplaced(trial) < misplaced(best) ? trial : best
      )

  // Greedily takes the step that leaves the columns closest to `wanted`,
  // then the one adding the fewest moves: anchoring a column on a
  // neighbour, alone or with the columns anchored on it, which would
  // otherwise travel with it.
  let moves = new Map<string, Reorder>()
  let score = misplaced(moves)
  while (score > 0) {
    let best:
      | {
          readonly moves: Map<string, Reorder>
          readonly score: number
          readonly cost: number
        }
      | undefined
    const consider = (trial: Map<string, Reorder>) => {
      const trialScore = misplaced(trial)
      const cost = trial.size - moves.size
      if (
        !best ||
        trialScore < best.score ||
        (trialScore === best.score && cost < best.cost)
      ) {
        best = { moves: trial, score: trialScore, cost }
      }
    }
    for (const column of wanted) {
      if (fixed(column) || (best?.score === 0 && best.cost <= 1)) {
        continue
      }
      const riders = wanted.filter(
        (other) =>
          !fixed(other) &&
          anchorOf(moves.get(other) ?? positions.get(other)) === column
      )
      for (const to of optionsOf(column)) {
        const trial = new Map(moves).set(column, to)
        consider(trial)
        if (riders.length > 0) {
          consider(riders.reduce(settle, trial))
        }
      }
    }
    if (!best || best.score >= score) {
      break
    }
    moves = best.moves
    score = best.score
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
