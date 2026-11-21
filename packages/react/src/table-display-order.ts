import type { Row, RowData, Table, TableFeatures } from "@tanstack/react-table"

import type { Expression } from "@pliantui/contract"
import { compareRowKeys } from "@pliantui/core"

type AnyTable = Table<TableFeatures, RowData>
type AnyRow = Row<TableFeatures, RowData>

/** A row's key: `getRowId`, else the field named `id`. */
export function rowKeyOf(row: AnyRow): unknown {
  return row.table.options.getRowId ? row.id : Reflect.get(row.original, "id")
}

/**
 * Compares two rows by display order: the table's sort, as the sorted row
 * model does, with ties, and an unsorted table, in ascending order of the row
 * key. `first`, `last` and the window functions read it.
 */
export function compareByTableSort(table: AnyTable) {
  const sorting = table.atoms.sorting.get()
  return (a: AnyRow, b: AnyRow) => {
    for (const { id, desc } of sorting) {
      const column = table.getColumn(id)
      if (!column?.getCanSort()) {
        continue
      }
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
    return compareRowKeys(rowKeyOf(a), rowKeyOf(b))
  }
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
