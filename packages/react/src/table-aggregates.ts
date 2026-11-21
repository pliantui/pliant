import {
  sortFn_basic,
  type AggregationFnDef,
  type ColumnDef,
  type Row,
  type RowData,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table"

import type { Expression, Layer } from "@pliantui/contract"
import {
  createAggregateEvaluator,
  formatError,
  type AggregateExpression,
  type ExpressionField,
  type ResolvedLayers,
  type RowValue,
} from "@pliantui/core"

/**
 * What aggregates are computed against: the dataset's fields, and the time
 * zone it reads dates in. A `defineDataset` result satisfies it.
 *
 * @experimental
 */
export interface PliantTableDataset {
  readonly fields: Readonly<Record<string, ExpressionField>>
  readonly timeZone: string
}

/** An `addAggregate` op that holds, as the layers resolve it. */
export interface TableAggregate {
  readonly id: string
  readonly label: string
  readonly expr: Expression
  readonly layer: Layer
}

type AnyTable = Table<TableFeatures, RowData>
type AnyRow = Row<TableFeatures, RowData>

// The bare id of a node from its address, as `page/slots/orders-table` is
// `orders-table`.
function identityOf(address: string) {
  const slots = address.lastIndexOf("/slots/")
  return slots < 0 ? address : address.slice(slots + "/slots/".length)
}

/** The aggregates of a table node, in the order their ops applied. */
export function aggregatesOf(
  resolved: ResolvedLayers,
  table: string
): TableAggregate[] {
  const properties = resolved.properties.get(identityOf(table))
  if (!properties) {
    return []
  }
  return Array.from(properties, ([key, { winner }]) => {
    const { op } = winner.check
    return key.startsWith("aggregate.") && op.op === "addAggregate"
      ? [
          {
            id: op.id,
            label: op.label,
            expr: op.expr,
            layer: winner.overlay.layer,
          },
        ]
      : []
  }).flat()
}

interface SortEntry {
  readonly desc: boolean
  readonly invert: boolean
  readonly id: string
  readonly compare: (a: AnyRow, b: AnyRow, id: string) => number
}

// The rows of a group in the order the table shows them: by its sort, with
// ties in the order of the data, as the sorted row model breaks them. A
// sort by an aggregate leaves rows tied, since only groups have its value.
function inDisplayOrder(
  rows: readonly AnyRow[],
  table: AnyTable
): readonly AnyRow[] {
  const entries = table.atoms.sorting
    .get()
    .flatMap(({ id, desc }): SortEntry[] => {
      const column = table.getAllFlatColumns().find((other) => other.id === id)
      return column?.getCanSort()
        ? [
            {
              desc,
              invert: column.columnDef.invertSorting === true,
              id,
              compare: column.getSortFn(),
            },
          ]
        : []
    })
  if (entries.length === 0) {
    return rows
  }
  return rows.toSorted((a, b) => {
    for (const { desc, invert, id, compare } of entries) {
      const order = compare(a, b, id)
      if (order !== 0) {
        return (desc ? -order : order) * (invert ? -1 : 1)
      }
    }
    return a.index - b.index
  })
}

function valuesOf(rows: readonly AnyRow[]) {
  return rows.map((row) => row.original)
}

function definitionOf(
  expression: AggregateExpression
): AggregationFnDef<TableFeatures, RowData, unknown, RowValue> {
  return {
    aggregate: ({ rows, table }) =>
      expression.aggregate(valuesOf(inDisplayOrder(rows, table))),
  }
}

/**
 * The table columns of aggregates, in the order given, and the aggregates
 * that can't be columns, each with its reason. An aggregate is a column with
 * no value on a data row: a group's row, and the column's total, hold its
 * value.
 */
export function aggregateColumns(
  aggregates: readonly TableAggregate[],
  dataset: PliantTableDataset | undefined,
  columns: readonly unknown[],
  taken: ReadonlySet<string>
): {
  readonly columns: readonly unknown[]
  readonly issues: string[]
} {
  const issues: string[] = []
  if (aggregates.length === 0) {
    return { columns, issues }
  }
  try {
    if (!dataset) {
      throw new TypeError("pass the table's dataset to usePliantTable")
    }
    // Aggregates of the viewer's own layers read today's date where they are.
    const zones = Object.fromEntries(
      aggregates.flatMap(({ id, layer }) =>
        layer === "personal" || layer === "session"
          ? [[id, new Intl.DateTimeFormat().resolvedOptions().timeZone]]
          : []
      )
    )
    const evaluate = createAggregateEvaluator({
      fields: dataset.fields,
      timeZone: dataset.timeZone,
      aggregates: Object.fromEntries(aggregates.map((a) => [a.id, a.expr])),
      aggregateTodayTimeZones: zones,
    })
    const added = aggregates.flatMap(({ id, label, expr }) => {
      if (taken.has(id)) {
        issues.push(`${id}: a column has its id`)
        return []
      }
      const result = evaluate(expr, { todayTimeZone: zones[id] })
      if (!result.success) {
        issues.push(`${id}: ${formatError(result.error)}`)
        return []
      }
      const { type, unit } = result.data
      const column: ColumnDef<TableFeatures, RowData> = {
        id,
        header: label,
        accessorFn: () => undefined,
        enableColumnFilter: false,
        enableGrouping: false,
        sortFn: sortFn_basic,
        meta: { label, pliant: { type, unit } },
        aggregationFn: definitionOf(result.data),
      }
      return [column]
    })
    return { columns: [...columns, ...added], issues }
  } catch (error) {
    return {
      columns,
      issues: aggregates.map(
        ({ id }) =>
          `${id}: ${error instanceof Error ? error.message : String(error)}`
      ),
    }
  }
}
