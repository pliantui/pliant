import type { Expression } from "@pliantui/contract"

import type {
  ExpressionCheckerOptions,
  ExpressionType,
} from "./check-expression"
import { createContext, type Scope } from "./expression-compiler"
import type { Inferred } from "./expression-types"
import type { Value } from "./read-value"
import { failure, type Result } from "./result"
import { dayMs } from "./time-zone"

/**
 * The value of an expression for one row. A date is written `YYYY-MM-DD` and
 * a datetime as an ISO 8601 date-time in UTC with milliseconds.
 *
 * @experimental
 */
export type RowValue = string | number | boolean | null

/**
 * Reads an expression's value from one row, like a TanStack Table
 * `accessorFn`.
 *
 * @experimental
 */
export type RowAccessor<TRow extends object = object> = (row: TRow) => RowValue

/**
 * What row expressions are evaluated against.
 *
 * @experimental
 */
export interface RowEvaluatorOptions<TRow extends object = object> extends Omit<
  ExpressionCheckerOptions,
  "aggregates"
> {
  /**
   * The dataset's IANA time zone. Dates and datetimes are read in it, and a
   * date compared with a datetime is the start of that day there.
   */
  readonly timeZone: string
  /**
   * The time zone `today` reads the current date in, by derived field id,
   * where it isn't the dataset's: the viewer's for a derived field defined
   * in a personal or session layer.
   */
  readonly todayTimeZones?: Readonly<Record<string, string>> | undefined
  /** The current time in milliseconds since the epoch. Defaults to `Date.now`. */
  readonly now?: (() => number) | undefined
  /**
   * Reads a field's value from a row, like a TanStack Table `accessorFn`:
   * use it for nested values, or to convert values the evaluator doesn't
   * read, such as a `bigint`, a decimal object or a numeric string, to a
   * number. By default, the row's property named by the field id is read,
   * own or inherited.
   *
   * Values are read by the field's type: numbers as finite JavaScript
   * numbers, text and booleans as themselves, and dates and datetimes from
   * ISO 8601 text or a `Date`. A `Date` in a date field is its UTC calendar
   * date, as database drivers return date columns. A value that doesn't fit,
   * such as an epoch number in a date field, is null.
   */
  readonly getValue?: ((row: TRow, fieldId: string) => unknown) | undefined
}

/**
 * An expression ready to read from rows: its accessor, and the type and unit
 * of its value as `createExpressionChecker` gives them, so a caller can
 * format the values and tell a date's text from other text.
 *
 * @experimental
 */
export interface RowExpression<
  TRow extends object = object,
> extends ExpressionType {
  readonly accessor: RowAccessor<TRow>
}

/**
 * Options for one expression.
 *
 * @experimental
 */
export interface RowExpressionOptions {
  /**
   * The time zone `today` reads the current date in for this expression.
   * Defaults to the dataset's. A time zone the runtime doesn't know fails
   * the expression.
   */
  readonly todayTimeZone?: string | undefined
}

/**
 * Checks a row expression and returns its accessor with its type, or the
 * issues that keep it from being evaluated.
 *
 * @experimental
 */
export type RowEvaluator<TRow extends object = object> = (
  expression: Expression,
  options?: RowExpressionOptions
) => Result<RowExpression<TRow>>

function isDateType(type: Inferred["type"] | undefined) {
  return type === "date" || type === "datetime"
}

/** A computed value as callers read it: a date or datetime as ISO 8601 text. */
export function output(
  value: Value,
  type: Inferred["type"] | undefined
): RowValue {
  if (value === null || !isDateType(type)) {
    return value
  }
  const iso = new Date(
    Number(value) * (type === "date" ? dayMs : 1)
  ).toISOString()
  return type === "date" ? iso.slice(0, -14) : iso
}

/**
 * Creates an evaluator for row expressions: those of derived fields and
 * highlights. It checks each expression as `createExpressionChecker` does,
 * then returns an accessor that computes it from a row by the function
 * catalog's semantics. A derived field that a `ref` names is computed once
 * per row, however many times it's referenced. An expression that uses a
 * window function, directly or by `ref`, fails: its value depends on every
 * row of its partition. Expressions are interpreted; no code is generated.
 *
 * Dates and datetimes are kept to the years 0000 to 9999: one computed
 * outside them is null.
 *
 * Throws a `RangeError` when `timeZone` or a value of `todayTimeZones` isn't
 * a time zone the runtime knows.
 *
 * @experimental
 */
export function createRowEvaluator<TRow extends object = object>(
  options: RowEvaluatorOptions<TRow>
): RowEvaluator<TRow> {
  const context = createContext(options)

  return (expression, { todayTimeZone } = {}) => {
    const timeZone = todayTimeZone ?? options.timeZone
    if (!context.knowsZone(timeZone)) {
      return failure([{ path: [], message: `Unknown time zone "${timeZone}"` }])
    }
    const checked = context.check(expression, "row")
    if (!checked.success) {
      return checked
    }
    const root = context.compile(expression, todayTimeZone)
    if (root.issues.length > 0) {
      return failure(root.issues)
    }
    const order = context.derivedOrder(root.refs)
    return {
      success: true,
      data: {
        ...checked.data,
        accessor: (row) => {
          context.tick()
          const scope: Scope = {
            read: (id) => context.getValue(row, id),
            values: new Map(),
            calls: [],
          }
          for (const [id, item] of order) {
            scope.values.set(id, item.run(scope))
          }
          return output(root.run(scope), checked.data.type)
        },
      },
    }
  }
}
