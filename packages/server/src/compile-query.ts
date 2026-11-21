import * as z from "zod"

import type { DatasetGrant } from "./authorize-dataset"
import type { Dataset, Fields } from "./define-dataset"
import { quote } from "./quote"
import { serverQuerySchema, type ServerQuery } from "./server-query"
import { compileFilter, textOf } from "./sql-filter"

/**
 * Where `compileQuery` reads a dataset's rows from, and how much it may
 * load at once.
 *
 * @experimental
 */
export interface CompileQueryOptions {
  /** The table, or view, that holds the dataset's rows. */
  readonly table: string
  /** The table's schema, such as `public`. Defaults to the connection's search path. */
  readonly schema?: string | undefined
  /**
   * Column names by field id, for fields stored under another name, such
   * as `{ createdAt: "created_at" }`. Any other field is stored in the
   * column named by its id. Keys of the user's row scope map the same way,
   * so a scope key can name a column that isn't a field.
   */
  readonly columns?: Readonly<Record<string, string>> | undefined
  /**
   * The most rows a page may have. A query asking for more gets this many.
   * Defaults to 100, and can't be more than 1000, so no request can make one
   * query read an unbounded number of rows.
   */
  readonly maxPageSize?: number | undefined
}

/**
 * A parameterized Postgres query: pass `text` and `values` to your driver,
 * as `pool.query(text, values)` takes them.
 *
 * @experimental
 */
export interface CompiledQuery {
  readonly text: string
  readonly values: unknown[]
}

const defaultMaxPageSize = 100
const hardMaxPageSize = 1000

function identifier(name: unknown) {
  if (
    typeof name !== "string" ||
    name === "" ||
    name.includes("\0") ||
    new TextEncoder().encode(name).length > 63
  ) {
    throw new TypeError(
      `${quote(name)} must be a Postgres identifier: 1 to 63 bytes, without NUL`
    )
  }
  return `"${name.replaceAll('"', '""')}"`
}

function checkScope(scope: DatasetGrant["scope"]) {
  const valid =
    scope === "all" ||
    (typeof scope === "object" &&
      Object.keys(scope).length > 0 &&
      Object.values(scope).every((value) => {
        const list = [value].flat()
        return (
          list.length > 0 &&
          list.every((item) =>
            ["string", "number", "boolean"].includes(typeof item)
          )
        )
      }))
  if (!valid) {
    throw new TypeError(
      'The grant\'s scope must be "all" or conditions from authorizeDataset'
    )
  }
}

/**
 * Compiles one page of a dataset's rows, for one user, to a parameterized
 * Postgres query. It selects the fields the grant lets the user read, each
 * under its field id; keeps only the rows that match the grant's scope and
 * every filter; orders them by the sort, then by the row key; and returns
 * the query's page, at most `maxPageSize` rows.
 *
 * Every value is a parameter. Table and column names come only from
 * `options` and the dataset, never from the query. The query is untrusted:
 * it is parsed before use, and it throws a `TypeError` when it isn't a
 * valid `ServerQuery`, names another dataset, or sorts or filters by a
 * field the user can't read, or whose capabilities don't allow it. A field
 * the user can't read is reported as missing, so the error gives no trace
 * of it.
 *
 * - Sorting reads text in the column's collation. Rows without a value go
 *   last, in either direction, unless `nulls` is `"first"`. Ties are broken
 *   by the row key: an `integer` key numerically, any other key as text by
 *   code point.
 * - `eq`, `neq` and `in` compare case-sensitively; `gt`, `gte`, `lt`,
 *   `lte` and `between` (inclusive) compare text by code point.
 *   `contains` and `startsWith` match text fields case-insensitively, with
 *   the database's `lower`. A row without a value passes only `isNull`.
 * - A date or datetime value without a time covers that day in the
 *   dataset's time zone, and one with a time but no offset is read in that
 *   zone. Store dates as `date` and datetimes as `timestamptz`.
 * - A value must fit its field: a number for a number, currency or
 *   percent field, a whole number for an integer field, a boolean for a
 *   boolean field, ISO 8601 text for a date or datetime field and text
 *   otherwise. Booleans take only `eq`, `neq`, `in` and `isNull`, and only
 *   text fields take `contains` and `startsWith`. `custom` filters are
 *   rejected.
 *
 * @experimental
 */
export function compileQuery<TUser>(
  dataset: Dataset<Fields, string, TUser>,
  grant: DatasetGrant,
  query: ServerQuery,
  options: CompileQueryOptions
): CompiledQuery {
  const fail = (problem: string): never => {
    throw new TypeError(`Query on dataset ${quote(dataset.id)}: ${problem}`)
  }
  const { maxPageSize = defaultMaxPageSize, columns = {} } = options
  if (
    !Number.isSafeInteger(maxPageSize) ||
    maxPageSize < 1 ||
    maxPageSize > hardMaxPageSize
  ) {
    throw new TypeError("maxPageSize must be a whole number from 1 to 1000")
  }
  const parsed = serverQuerySchema.safeParse(query)
  if (!parsed.success) {
    return fail(z.prettifyError(parsed.error))
  }
  const { sort = [], filters = [], page } = parsed.data
  if (parsed.data.dataset !== dataset.id) {
    fail(`the query is for dataset ${quote(parsed.data.dataset)}`)
  }
  checkScope(grant.scope)
  const readable = new Set(
    grant.fields.filter((id) => Object.hasOwn(dataset.fields, id))
  )
  if (readable.size !== grant.fields.length) {
    fail("the grant doesn't fit the dataset")
  }

  const values: unknown[] = []
  const param = (value: unknown) => `$${String(values.push(value))}`
  let zone: string | undefined
  const timeZone = () => (zone ??= `${param(dataset.timeZone)}::text`)
  const column = (key: string) =>
    identifier(Object.hasOwn(columns, key) ? columns[key] : key)
  const field = (id: string) => {
    const found = readable.has(id) ? dataset.fields[id] : undefined
    return found ?? fail(`no field ${quote(id)}`)
  }

  const select = [...readable]
    .map((id) => `${column(id)} AS ${identifier(id)}`)
    .join(", ")
  const table =
    options.schema === undefined
      ? identifier(options.table)
      : `${identifier(options.schema)}.${identifier(options.table)}`

  const where =
    grant.scope === "all"
      ? []
      : Object.entries(grant.scope).map(([key, value]) =>
          Array.isArray(value)
            ? `${column(key)} = ANY(${param(value)})`
            : `${column(key)} = ${param(value)}`
        )
  for (const filter of filters) {
    const { type, filterable } = field(filter.field)
    const search =
      filter.operator === "contains" || filter.operator === "startsWith"
    if (filterable === false || (filterable === "search" && !search)) {
      fail(`${quote(filter.field)} can't be filtered with ${filter.operator}`)
    }
    const condition = compileFilter(filter, {
      column: column(filter.field),
      type,
      param,
      timeZone,
    })
    where.push(
      typeof condition === "string"
        ? condition
        : fail(`${quote(filter.field)}: ${condition.problem}`)
    )
  }

  const order = sort.map(({ field: id, desc, nulls = "last" }) => {
    const { type, sortable } = field(id)
    if (!sortable) {
      fail(`${quote(id)} can't be sorted`)
    }
    const direction = desc ? "DESC" : "ASC"
    return `${textOf(column(id), type)} ${direction} NULLS ${nulls.toUpperCase()}`
  })
  for (const key of dataset.rowKey) {
    order.push(
      field(key).type === "integer"
        ? `${column(key)} ASC`
        : `${column(key)}::text COLLATE "C" ASC`
    )
  }

  const size = Math.min(page.size, maxPageSize)
  return {
    text: [
      `SELECT ${select} FROM ${table}`,
      ...(where.length > 0 ? [`WHERE ${where.join(" AND ")}`] : []),
      `ORDER BY ${order.join(", ")}`,
      `LIMIT ${param(size)} OFFSET ${param(page.index * size)}`,
    ].join(" "),
    values,
  }
}
