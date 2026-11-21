import type { Row, RowData, TableFeatures } from "@tanstack/react-table"

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
import { evaluatorOptions, viewerZones } from "./table-ops"

/**
 * The derived columns and aggregates that can be columns, and each that
 * can't with its reason: no dataset, an id a column has, or an expression
 * that fails its check. The ids it accepts are added to `taken`, so a derived
 * column that comes first wins over an aggregate with its id. Derived columns
 * can `ref` one another, and aggregate functions can `ref` them.
 */
export function acceptedColumns(
  derived: readonly TableDerived[],
  aggregates: readonly TableAggregate[],
  dataset: PliantTableDataset | undefined,
  taken: Set<string>
) {
  const accepted: (AcceptedDerived | AcceptedAggregate)[] = []
  const issues: string[] = []
  const accept = (column: AcceptedDerived | AcceptedAggregate) => {
    accepted.push(column)
    taken.add(column.id)
  }
  const reject = (item: TableDerived | TableAggregate, reason: string) => {
    const kind = item.op === "addDerived" ? "derived column" : "aggregate"
    issues.push(`${kind} ${item.id}: ${reason}`)
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
      const todayTimeZone = options.todayTimeZones[id]
      // Only a window function fails a row expression that checks.
      const row = evaluateRow(expr, { todayTimeZone })
      const result = row.success ? row : evaluateWindow(expr, { todayTimeZone })
      if (result.success) {
        accept({ ...item, expression: result.data })
      } else {
        reject(item, formatError(result.error))
      }
    }
  } catch (error) {
    for (const item of [...derived, ...aggregates]) {
      reject(item, error instanceof Error ? error.message : String(error))
    }
  }
  return { accepted, issues }
}
