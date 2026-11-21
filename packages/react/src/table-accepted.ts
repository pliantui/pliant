import type { Row, RowData, TableFeatures } from "@tanstack/react-table"

import type { Expression } from "@pliantui/contract"
import {
  createAggregateEvaluator,
  createRowEvaluator,
  createWindowEvaluator,
  formatError,
} from "@pliantui/core"

import type {
  AcceptedAggregate,
  PliantTableDataset,
  TableAggregate,
} from "./table-aggregates"
import type { AcceptedDerived, TableDerived } from "./table-derived"
import { readsOrder, rowKeyOf } from "./table-display-order"
import type { AcceptedHighlight, TableHighlight } from "./table-highlights"
import { evaluatorOptions, viewerZones } from "./table-ops"

const kinds = {
  addDerived: "derived column",
  addAggregate: "aggregate",
  addHighlight: "highlight",
}

/**
 * The derived columns and aggregates that can be columns, and the highlights
 * that can be computed, and each that can't with its reason: no dataset, an
 * id a column has, or an expression that fails its check, or for a
 * highlight isn't true or false. The ids of the columns it accepts are added
 * to `taken`, so a derived column that comes first wins over an aggregate
 * with its id; highlights have ids of their own. Derived columns can `ref`
 * one another, and aggregate functions and highlights can `ref` them.
 */
export function acceptedColumns(
  derived: readonly TableDerived[],
  aggregates: readonly TableAggregate[],
  highlights: readonly TableHighlight[],
  dataset: PliantTableDataset | undefined,
  taken: Set<string>
) {
  const accepted: (AcceptedDerived | AcceptedAggregate)[] = []
  const shown: AcceptedHighlight[] = []
  const issues: string[] = []
  const accept = (column: AcceptedDerived | AcceptedAggregate) => {
    accepted.push(column)
    taken.add(column.id)
  }
  const reject = (
    item: TableDerived | TableAggregate | TableHighlight,
    reason: string
  ) => {
    issues.push(`${kinds[item.op]} ${item.id}: ${reason}`)
  }
  try {
    if (!dataset) {
      throw new TypeError("pass the table's dataset to usePliantTable")
    }
    const options = evaluatorOptions(dataset, derived)
    const evaluateRow = createRowEvaluator(options)
    const evaluateWindow = createWindowEvaluator<Row<TableFeatures, RowData>>({
      ...options,
      getValue: (row, id): unknown => Reflect.get(row.original, id),
      getRowId: rowKeyOf,
    })
    const expressions = new Map(aggregates.map(({ id, expr }) => [id, expr]))
    const zones = viewerZones(aggregates)
    // Only a window function fails a row expression that checks.
    const evaluate = (expr: Expression, todayTimeZone?: string) => {
      const row = evaluateRow(expr, { todayTimeZone })
      return row.success ? row : evaluateWindow(expr, { todayTimeZone })
    }
    const highlightZones = viewerZones(highlights)
    for (const item of highlights) {
      const result = evaluate(item.when, highlightZones[item.id])
      if (!result.success) {
        reject(item, formatError(result.error))
      } else if (result.data.type === "boolean") {
        shown.push({ ...item, expression: result.data })
      } else {
        reject(item, "its condition isn't true or false")
      }
    }
    const evaluateAggregate = createAggregateEvaluator({
      ...options,
      aggregates: Object.fromEntries(expressions),
      aggregateTodayTimeZones: zones,
    })
    for (const item of [...derived, ...aggregates]) {
      const { id, expr } = item
      if (taken.has(id)) {
        reject(item, "a column has its id")
        continue
      }
      if (item.op === "addAggregate") {
        const result = evaluateAggregate(expr, { todayTimeZone: zones[id] })
        if (result.success) {
          const ordered = readsOrder(expr, expressions)
          accept({ ...item, expression: result.data, ordered })
        } else {
          reject(item, formatError(result.error))
        }
        continue
      }
      const result = evaluate(expr, options.todayTimeZones[id])
      if (result.success) {
        accept({ ...item, expression: result.data })
      } else {
        reject(item, formatError(result.error))
      }
    }
  } catch (error) {
    for (const item of [...derived, ...aggregates, ...highlights]) {
      reject(item, error instanceof Error ? error.message : String(error))
    }
  }
  return { accepted, highlights: shown, issues }
}
