import type { Row, RowData, TableFeatures } from "@tanstack/react-table"

import type { RowExpression, WindowExpression } from "@pliantui/core"

import { readAccessor, readWindow } from "./table-derived-values"
import type { LayeredOp } from "./table-ops"

type AnyRow = Row<TableFeatures, RowData>

/** An `addHighlight` op that holds, as the layers resolve it. */
export type TableHighlight = LayeredOp<"addHighlight">

/** A highlight whose condition checks as true or false, accepted to compute. */
export interface AcceptedHighlight extends TableHighlight {
  readonly expression: RowExpression | WindowExpression<AnyRow>
}

/**
 * A highlight a row has: the `id` and `tone` of its `addHighlight` op.
 *
 * @experimental
 */
export interface PliantHighlight {
  readonly id: string
  readonly tone: TableHighlight["tone"]
}

type Highlighter = (row: AnyRow) => PliantHighlight[]

// The table's options hold a key to its highlights, under a symbol so it
// can't meet the developer's options. The highlights stay in this map, so
// what the options hold is checked by looking it up rather than trusted.
const optionKey = Symbol()
const highlighters = new WeakMap<object, Highlighter>()

/** The table option that gives `getPliantHighlights` the table's highlights. */
export function highlightsOption(highlights: readonly AcceptedHighlight[]) {
  const readers = highlights.map(({ id, tone, expression }) => ({
    id,
    tone,
    read:
      "compute" in expression
        ? readWindow(expression)
        : readAccessor(expression.accessor),
  }))
  const key = {}
  highlighters.set(key, (row) =>
    readers
      .filter(({ read }) => read(row) === true)
      .map(({ id, tone }) => ({ id, tone }))
  )
  return { [optionKey]: key }
}

/**
 * The highlights a row of a table made with `usePliantTable` has: those of
 * the table's `addHighlight` ops whose condition (`when`) is true for it, in
 * the order the ops applied, so the last one is the one applied last. A
 * group's row has none. Each is computed once per row; one with window
 * functions is computed again when its partition or the sort changes, as a
 * derived column is.
 *
 * @experimental
 */
export function getPliantHighlights<
  TFeatures extends TableFeatures,
  TData extends RowData,
>(row: Row<TFeatures, TData>): PliantHighlight[] {
  const key: unknown = Reflect.get(row.table.options, optionKey)
  const highlighter =
    typeof key === "object" && key !== null ? highlighters.get(key) : undefined
  // A group's row carries the id of the column it groups by.
  const grouped = Reflect.get(row, "groupingColumnId") !== undefined
  // TanStack's row types are invariant in their features, so a row of the
  // developer's features is read as any row: a highlighter is only found on
  // a table that `usePliantTable` made, whose rows have the features read.
  return highlighter && !grouped ? highlighter(row as unknown as AnyRow) : []
}
