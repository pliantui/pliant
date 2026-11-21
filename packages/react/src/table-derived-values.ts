import type {
  Row,
  RowData,
  TableFeature,
  TableFeatures,
} from "@tanstack/react-table"

import type { RowAccessor, RowValue, WindowExpression } from "@pliantui/core"

import { compareByTableSort } from "./table-display-order"

type AnyRow = Row<TableFeatures, RowData>

type ReadValue = (row: AnyRow) => RowValue | undefined

// A derived column's `accessorFn` stands for how its values are read, which
// needs the row and not only its data: a value can depend on the row's group
// and on the sort.
const readers = new WeakMap<object, ReadValue>()

/**
 * An `accessorFn` for a derived column that reads its values with `read`
 * instead. TanStack caches a column's values per row for as long as its
 * data lives, so a column redefined, or a window value whose partition or
 * order changed, would show the old ones.
 */
export function derivedAccessor(read: ReadValue) {
  const accessorFn = () => undefined
  readers.set(accessorFn, read)
  return accessorFn
}

/**
 * The feature that reads the values of derived columns: `row.getValue` calls
 * their reader and leaves other columns to TanStack.
 *
 * It wraps a core API through `assignRowPrototype` because TanStack offers no
 * other way to make a column's value depend on its row's group, the filters
 * and the sort: `accessorFn` gets only the row's data, and `row.getValue`
 * caches its result for as long as the data lives.
 */
export const derivedValuesFeature: TableFeature = {
  assignRowPrototype: (prototype) => {
    const getValue: unknown = prototype["getValue"]
    if (typeof getValue !== "function") {
      return
    }
    prototype["getValue"] = function (this: AnyRow, columnId: string): unknown {
      const accessorFn = this.table.getColumn(columnId)?.accessorFn
      const read = accessorFn && readers.get(accessorFn)
      const value: unknown = read
        ? read(this)
        : Reflect.apply(getValue, this, [columnId])
      return value
    }
  },
}

/** Values of an expression that reads one row, computed once per row. */
export function readAccessor(accessor: RowAccessor): ReadValue {
  const values = new WeakMap<AnyRow, RowValue | undefined>()
  return (row) => {
    if (!values.has(row)) {
      values.set(row, accessor(row.original) ?? undefined)
    }
    return values.get(row)
  }
}

// The rows that share a window: a group's, else every row after filters.
function partitionsOf(rows: readonly AnyRow[]): (readonly AnyRow[])[] {
  return rows[0]?.getIsGrouped()
    ? rows.flatMap((group) => partitionsOf(group.subRows))
    : [rows]
}

// Whether window values are being computed, which sorting reads: a sort by a
// window column can't be known before the order is, so its rows are tied.
let computing = false

/**
 * Values of an expression with window functions, computed for every
 * partition together when a row's is asked for, and again when the rows
 * before sorting or the sort change. A window function's order leaves out
 * sorts by columns with window functions.
 */
export function readWindow(expression: WindowExpression<AnyRow>): ReadValue {
  let last:
    | readonly [unknown, unknown, WeakMap<AnyRow, RowValue | undefined>]
    | undefined
  return (row) => {
    if (computing) {
      return undefined
    }
    const { table } = row
    const model = table.getPreSortedRowModel()
    const sorting = table.atoms.sorting.get()
    if (last?.[0] !== model || last[1] !== sorting) {
      const values = new WeakMap<AnyRow, RowValue | undefined>()
      const compare = compareByTableSort(table)
      computing = true
      try {
        for (const rows of partitionsOf(model.rows)) {
          const results = expression.compute(rows, { compare })
          rows.forEach((partitioned, index) => {
            values.set(partitioned, results[index] ?? undefined)
          })
        }
      } finally {
        computing = false
      }
      last = [model, sorting, values]
    }
    return last[2].get(row)
  }
}
