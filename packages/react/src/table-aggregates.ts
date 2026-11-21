import {
  sortFn_basic,
  type ColumnDef,
  type Row,
  type RowData,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table"

import type { Expression, Layer } from "@pliantui/contract"
import {
  compareCodePoints,
  createAggregateEvaluator,
  formatError,
  type AggregateExpression,
  type ExpressionField,
  type ResolvedLayers,
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

/** The aggregates of a table node, in the order their ops applied. */
export function aggregatesOf(
  resolved: ResolvedLayers,
  table: string
): TableAggregate[] {
  // A node's identity is its bare id: the part after its last `/slots/`.
  const properties = resolved.properties.get(
    table.split("/slots/").slice(-1).join()
  )
  if (!properties) {
    return []
  }
  return Array.from(properties.values(), ({ winner }) => {
    const { op } = winner.check
    return op.op === "addAggregate"
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

// The rows of a group in the order the table shows them: by its sort, as the
// sorted row model compares them, with ties and an unsorted table in
// ascending order of the row key. A sort by an aggregate leaves rows tied,
// since only groups have its value.
function inDisplayOrder(
  rows: readonly AnyRow[],
  table: AnyTable
): readonly AnyRow[] {
  const sorts = table.atoms.sorting.get().flatMap(({ id, desc }) => {
    const column = table.getColumn(id)
    return column?.getCanSort()
      ? [{ id, desc, column, compare: column.getSortFn() }]
      : []
  })
  const keyOf = (row: AnyRow) =>
    String(table.options.getRowId ? row.id : Reflect.get(row.original, "id"))
  return rows.toSorted((a, b) => {
    for (const { id, desc, column, compare } of sorts) {
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
      order ||= compare(a, b, id)
      if (order !== 0) {
        return desc === !invertSorting ? -order : order
      }
    }
    return compareCodePoints(keyOf(a), keyOf(b))
  })
}

// Whether an aggregate expression that checks, so has no reference cycle,
// reads the order of a group's rows, itself or through the aggregates it
// refers to.
function readsOrder(
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

/** An aggregate that can be a column, accepted to compute. */
export interface AcceptedAggregate extends TableAggregate {
  readonly expression: AggregateExpression
  /** Whether it reads the order of a group's rows, as `first` and `last` do. */
  readonly ordered: boolean
}

/**
 * The aggregates that can be columns, and each that can't with its reason:
 * no dataset, an expression that fails its check, or an id a column has.
 */
export function acceptedAggregates(
  aggregates: readonly TableAggregate[],
  dataset: PliantTableDataset | undefined,
  taken: ReadonlySet<string>
): { readonly accepted: AcceptedAggregate[]; readonly issues: string[] } {
  const issues: string[] = []
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
    const expressions = new Map(aggregates.map((a) => [a.id, a.expr]))
    const evaluate = createAggregateEvaluator({
      fields: dataset.fields,
      timeZone: dataset.timeZone,
      aggregates: Object.fromEntries(expressions),
      aggregateTodayTimeZones: zones,
    })
    const accepted = aggregates.flatMap((aggregate): AcceptedAggregate[] => {
      const { id, expr } = aggregate
      if (taken.has(id)) {
        issues.push(`${id}: a column has its id`)
        return []
      }
      const result = evaluate(expr, { todayTimeZone: zones[id] })
      if (!result.success) {
        issues.push(`${id}: ${formatError(result.error)}`)
        return []
      }
      return [
        {
          ...aggregate,
          expression: result.data,
          ordered: readsOrder(expr, expressions),
        },
      ]
    })
    return { accepted, issues }
  } catch (error) {
    return {
      accepted: [],
      issues: aggregates.map(
        ({ id }) =>
          `${id}: ${error instanceof Error ? error.message : String(error)}`
      ),
    }
  }
}

/**
 * The table's columns and one for each aggregate. An aggregate is a column
 * with no value on a data row: a group's row, and the column's total, hold
 * its value.
 */
export function aggregateColumns(
  accepted: readonly AcceptedAggregate[],
  columns: readonly unknown[]
): readonly unknown[] {
  return accepted.length === 0
    ? columns
    : [
        ...columns,
        ...accepted.map(
          ({ id, label, expression, ordered }) =>
            ({
              id,
              header: label,
              accessorFn: () => undefined,
              enableColumnFilter: false,
              enableGrouping: false,
              sortFn: sortFn_basic,
              meta: {
                label,
                pliant: { type: expression.type, unit: expression.unit },
              },
              aggregationFn: {
                aggregate: ({ rows, table }) =>
                  expression.aggregate(
                    (ordered ? inDisplayOrder(rows, table) : rows).map(
                      (row) => row.original
                    )
                  ),
              },
            }) satisfies ColumnDef<TableFeatures, RowData>
        ),
      ]
}
