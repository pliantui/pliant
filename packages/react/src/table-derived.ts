import type {
  ColumnDef,
  Row,
  RowData,
  TableFeatures,
} from "@tanstack/react-table"

import type { RowExpression, WindowExpression } from "@pliantui/core"

import {
  derivedAccessor,
  readAccessor,
  readWindow,
} from "./table-derived-values"
import type { LayeredOp } from "./table-ops"

/** An `addDerived` op that holds, as the layers resolve it. */
export type TableDerived = LayeredOp<"addDerived">

type AnyRow = Row<TableFeatures, RowData>

/**
 * A derived column that can be a column, accepted to compute: from each row,
 * or, with window functions, from the rows of its partition.
 */
export interface AcceptedDerived extends TableDerived {
  readonly expression: RowExpression | WindowExpression<AnyRow>
}

/**
 * A derived column, which has a value on every data row and none on a
 * group's. It can be sorted, filtered, grouped and hidden like a data
 * column, except that a column with window functions has values only for the
 * rows that pass the filters and are in their groups, so it can't be
 * filtered or grouped by. A value that is null has no value, so it sorts
 * last. `meta.pliant` has its `type`, `unit` and `format`.
 */
export function derivedColumn({
  id,
  label,
  format,
  expression,
}: AcceptedDerived) {
  const windowed = "compute" in expression
  return {
    id,
    header: label,
    accessorFn: derivedAccessor(
      windowed ? readWindow(expression) : readAccessor(expression.accessor)
    ),
    enableGrouping: !windowed,
    enableColumnFilter: !windowed,
    sortUndefined: "last",
    meta: {
      label,
      pliant: {
        type: expression.type,
        unit: expression.unit,
        format,
        derived: true,
      },
    },
  } satisfies ColumnDef<TableFeatures, RowData>
}
