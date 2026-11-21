import {
  sortFn_basic,
  type ColumnDef,
  type RowData,
  type TableFeatures,
} from "@tanstack/react-table"

import type { AggregateExpression, ExpressionField } from "@pliantui/core"

import { compareByTableSort } from "./table-display-order"
import type { LayeredOp } from "./table-ops"

/**
 * What derived columns and aggregates are computed against: the dataset's
 * fields, and the time zone it reads dates in. A `defineDataset` result
 * satisfies it.
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
          (ordered ? rows.toSorted(compareByTableSort(table)) : rows).map(
            (row) => row.original
          )
        ),
    },
  } satisfies ColumnDef<TableFeatures, RowData>
}
