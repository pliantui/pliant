import {
  sortFn_basic,
  type ColumnDef,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table"

import {
  createAggregateEvaluator,
  formatError,
  type AggregateExpression,
  type ExpressionField,
} from "@pliantui/core"

import { acceptItems } from "./table-accepted"
import { inDisplayOrder, readsOrder } from "./table-display-order"
import { evaluatorOptions, type LayeredOp } from "./table-ops"

/**
 * What derived columns and aggregates are computed against: the dataset's
 * fields, and the time zone it reads dates in. A `defineDataset` result satisfies it.
 *
 * @experimental
 */
export interface PliantTableDataset {
  readonly fields: Readonly<Record<string, ExpressionField>>
  readonly timeZone: string
}

/** An `addAggregate` op that holds, as the layers resolve it. */
export type TableAggregate = LayeredOp<"addAggregate">

/** An aggregate that can be a column, accepted to compute. */
export interface AcceptedAggregate extends TableAggregate {
  readonly expression: AggregateExpression
  /** Whether it reads the order of a group's rows, as `first` and `last` do. */
  readonly ordered: boolean
}

/**
 * The aggregates that can be columns, and each that can't with its reason:
 * no dataset, an expression that fails its check, or an id a column has.
 * Aggregate functions read the `derived` columns by `ref`.
 */
export function acceptedAggregates(
  aggregates: readonly TableAggregate[],
  dataset: PliantTableDataset | undefined,
  taken: Set<string>,
  derived: readonly LayeredOp<"addDerived">[]
) {
  const expressions = new Map(aggregates.map((a) => [a.id, a.expr]))
  return acceptItems(
    aggregates,
    dataset,
    taken,
    "aggregate",
    (dataset, zones) => {
      const evaluate = createAggregateEvaluator({
        ...evaluatorOptions(dataset, derived),
        aggregates: Object.fromEntries(expressions),
        aggregateTodayTimeZones: zones,
      })
      return ({ expr }, todayTimeZone) => {
        const result = evaluate(expr, { todayTimeZone })
        return result.success
          ? {
              expression: result.data,
              ordered: readsOrder(expr, expressions),
            }
          : formatError(result.error)
      }
    }
  )
}

/**
 * An aggregate's column: it has no value on a data row, and a group's row,
 * and the column's total, hold its value.
 */
export function aggregateColumn({
  id,
  label,
  expression,
  ordered,
}: AcceptedAggregate) {
  return {
    id,
    header: label,
    accessorFn: () => undefined,
    enableColumnFilter: false,
    enableGrouping: false,
    sortFn: sortFn_basic,
    meta: { label, pliant: { type: expression.type, unit: expression.unit } },
    aggregationFn: {
      aggregate: ({ rows, table }) =>
        expression.aggregate(
          (ordered ? inDisplayOrder(rows, table) : rows).map(
            (row) => row.original
          )
        ),
    },
  } satisfies ColumnDef<TableFeatures, RowData>
}
