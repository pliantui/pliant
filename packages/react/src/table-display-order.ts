import type { Row, RowData, Table, TableFeatures } from "@tanstack/react-table"

import type { Expression } from "@pliantui/contract"
import { compareCodePoints } from "@pliantui/core"

type AnyTable = Table<TableFeatures, RowData>
type AnyRow = Row<TableFeatures, RowData>

/** A row's key: `getRowId`, else the field named `id`, as text. */
export function rowKeyOf(row: AnyRow) {
  return String(
    row.table.options.getRowId ? row.id : Reflect.get(row.original, "id")
  )
}

/**
 * Compares two rows by the table's sort, as the sorted row model does, and
 * gives 0 for rows it ties. Display order is this order with ties, and an
 * unsorted table, in ascending order of the row key: `first`, `last` and the
 * window functions read it.
 */
export function compareByTableSort(table: AnyTable) {
  const sorts = table.atoms.sorting.get().flatMap(({ id, desc }) => {
    const column = table.getColumn(id)
    return column?.getCanSort() ? [{ id, desc, column }] : []
  })
  return (a: AnyRow, b: AnyRow) => {
    for (const { id, desc, column } of sorts) {
      const { sortUndefined, invertSorting } = column.columnDef
      let order = 0
      if (sortUndefined) {
        const [x, y] = [a, b].map((row) => row.getValue(id) === undefined)
        if (x && y) {
          continue
        }
        if (x || y) {
          if (typeof sortUndefined === "string") {
            return (sortUndefined === "first") === x ? -1 : 1
          }
          order = x ? sortUndefined : -sortUndefined
        }
      }
      order ||= column.getSortFn()(a, b, id)
      if (order !== 0) {
        return desc === !invertSorting ? -order : order
      }
    }
    return 0
  }
}

/** The rows in display order. */
export function inDisplayOrder(
  rows: readonly AnyRow[],
  table: AnyTable
): readonly AnyRow[] {
  const compare = compareByTableSort(table)
  return rows.toSorted(
    (a, b) => compare(a, b) || compareCodePoints(rowKeyOf(a), rowKeyOf(b))
  )
}

/**
 * Whether an aggregate expression that checks, so has no reference cycle,
 * reads the order of a group's rows, itself or through the aggregates it
 * refers to.
 */
export function readsOrder(
  expression: Expression,
  aggregates: ReadonlyMap<string, Expression>
): boolean {
  if ("fn" in expression) {
    return (
      expression.fn === "first" ||
      expression.fn === "last" ||
      expression.args.some((arg) => readsOrder(arg, aggregates))
    )
  }
  const target =
    "ref" in expression ? aggregates.get(expression.ref) : undefined
  return target !== undefined && readsOrder(target, aggregates)
}
