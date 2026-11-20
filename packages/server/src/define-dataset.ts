import { itemIdSchema } from "@pliantui/contract"

import {
  checkField,
  defaultCapabilities,
  isText,
  type DatasetField,
  type DatasetFieldCapabilities,
  type DatasetFieldType,
  type FieldKey,
} from "./dataset-field"
import { quote } from "./quote"
import { isRecord, snapshot } from "./snapshot"

type Fields = Readonly<Record<string, DatasetField>>

type KeyType = "id" | "string" | "integer" | "email" | "url"

/**
 * The ids of the fields that can be a row key, or any id when the fields
 * are only known as a record.
 */
type KeyField<TFields extends Fields> = string extends keyof TFields
  ? string
  : {
      [K in keyof TFields]: TFields[K]["type"] extends KeyType ? K : never
    }[keyof TFields] &
      string

/** Each field, with the options its type doesn't take typed as `never`. */
type ExactFields<TFields extends Fields> = {
  readonly [K in keyof TFields]: TFields[K] &
    Readonly<
      Record<Exclude<keyof TFields[K], FieldKey<TFields[K]["type"]>>, never>
    >
}

type RowKeyOption<TFields extends Fields, TKey extends string> =
  "id" extends KeyField<TFields>
    ? {
        /**
         * The field, or up to 10 fields in order, that identify each row:
         * `id`, `string`, `integer`, `email` or `url` fields. Defaults to
         * the field named `id`. A row key field doesn't have to be
         * sortable.
         */
        readonly rowKey?: TKey | readonly [TKey, ...TKey[]] | undefined
      }
    : {
        /**
         * The field, or up to 10 fields in order, that identify each row:
         * `id`, `string`, `integer`, `email` or `url` fields. A row key
         * field doesn't have to be sortable.
         */
        readonly rowKey: TKey | readonly [TKey, ...TKey[]]
      }

type TimeZoneOption<TFields extends Fields> = [
  Extract<TFields[keyof TFields]["type"], "date" | "datetime">,
] extends [never]
  ? {
      /**
       * The region-based IANA time zone dates and datetimes are read in, or
       * `UTC`, kept as written. Defaults to `UTC`.
       */
      readonly timeZone?: string | undefined
    }
  : {
      /**
       * The region-based IANA time zone dates and datetimes are read in,
       * such as `Asia/Tokyo`, or `UTC`, kept as written. Required with a
       * date or datetime field.
       */
      readonly timeZone: string
    }

/**
 * What `defineDataset` takes.
 *
 * @experimental
 */
export type DatasetDefinition<
  TFields extends Fields = Fields,
  TKey extends KeyField<TFields> = KeyField<TFields>,
> = {
  /** The dataset's id, such as `orders`. */
  readonly id: string
  /** What the dataset holds, for people and the model: up to 500 characters. */
  readonly describe?: string | undefined
  /** The fields, by id, in the order they are listed. */
  readonly fields: TFields & ExactFields<TFields>
} & RowKeyOption<TFields, TKey> &
  TimeZoneOption<TFields>

type ResolvedField<TField extends DatasetField> = TField extends unknown
  ? {
      readonly [
        K in keyof TField as K extends keyof DatasetFieldCapabilities
          ? never
          : K
      ]: Readonly<TField[K]>
    } & Required<{
      readonly [K in keyof DatasetFieldCapabilities]-?: Exclude<
        DatasetFieldCapabilities[K],
        undefined
      >
    }>
  : never

/**
 * A checked dataset. Its fields carry every capability, resolved from their
 * type's defaults and their own overrides, and feed core's
 * `createExpressionChecker` and `createRowEvaluator` as they are.
 *
 * @experimental
 */
export interface Dataset<
  TFields extends Fields = Fields,
  TKey extends string = string,
> {
  readonly id: string
  readonly describe?: string
  /** The IANA name of the dataset's time zone, exactly as written. */
  readonly timeZone: string
  readonly rowKey: readonly [TKey, ...TKey[]]
  readonly fields: { readonly [K in keyof TFields]: ResolvedField<TFields[K]> }
}

type ValueOf<TField extends DatasetField> = TField extends {
  readonly values: readonly (infer V)[]
}
  ? V
  : TField["type"] extends "number" | "integer" | "currency" | "percent"
    ? number
    : TField["type"] extends "boolean"
      ? boolean
      : TField["type"] extends "date" | "datetime"
        ? string | Date
        : string

/**
 * The type of a dataset's rows: each field's value, or `null`, except the
 * row key's fields, which always have a value. Dates and datetimes are ISO
 * 8601 text or a `Date`.
 *
 * @experimental
 */
export type InferRow<TDataset extends Dataset> =
  TDataset extends Dataset<infer TFields, infer TKey>
    ? {
        -readonly [K in keyof TFields]: K extends TKey
          ? ValueOf<TFields[K]>
          : ValueOf<TFields[K]> | null
      }
    : never

const keyTypes = new Set<unknown>(["id", "string", "integer", "email", "url"])

const datasetKeys = new Set(["id", "describe", "timeZone", "fields", "rowKey"])

// Objects, then fields, then each field, then its format and values.
const depth = 4

// One more than any list's limit, so a longer list is still reported.
const maxItems = 101

const maxProblems = 20

const maxRowKey = 10

// Offsets and the zones that only stand for one: Etc/*, GMT and its
// variants, the other names of UTC, and EST, MST and HST, which never
// change. UTC itself is accepted.
const offsetZone =
  /^(?:[+-]|etc\/|gmt|(?:uct|zulu|universal|greenwich|est|mst|hst)$)/i

/**
 * Whether `Intl` accepts a time zone that is a region-based IANA name, or
 * UTC. The name is kept as written, not replaced by the one `Intl` resolves
 * it to, which depends on the runtime's time zone data: some resolve
 * `Asia/Kolkata` to its older name `Asia/Calcutta`.
 */
function isTimeZoneName(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || offsetZone.test(timeZone)) {
    return false
  }
  try {
    const resolved = new Intl.DateTimeFormat("en", {
      timeZone,
    }).resolvedOptions().timeZone
    return !/^[+-]/.test(resolved)
  } catch {
    return false
  }
}

function typeOf(field: unknown) {
  return isRecord(field) ? field["type"] : undefined
}

function checkRowKey(
  rowKey: unknown,
  fields: Readonly<Record<string, unknown>>,
  report: (message: string) => void
) {
  const keys = Array.isArray(rowKey) ? rowKey : [rowKey]
  if (keys.length === 0 || keys.length > maxRowKey) {
    report(`rowKey must name 1 to ${String(maxRowKey)} fields`)
    return
  }
  if (new Set(keys).size !== keys.length) {
    report("rowKey must not name a field twice")
  }
  for (const key of keys) {
    if (typeof key !== "string" || !Object.hasOwn(fields, key)) {
      report(`rowKey names ${quote(key)}, which isn't a field`)
    } else if (!keyTypes.has(typeOf(fields[key]))) {
      report(
        `rowKey field ${quote(key)} must be an id, string, integer, email or url field`
      )
    }
  }
}

function checkFields(
  definition: Readonly<Record<string, unknown>>,
  report: (message: string) => void
) {
  const { fields, rowKey, timeZone } = definition
  if (!isRecord(fields)) {
    report("fields must be an object of fields by id")
    return
  }
  const ids = Object.keys(fields)
  if (ids.length === 0) {
    report("fields must declare at least one field")
  }
  for (const id of ids) {
    checkField(id, fields[id], report)
  }
  const timed = ids.some((id) =>
    ["date", "datetime"].includes(String(typeOf(fields[id])))
  )
  if (timeZone === undefined && timed) {
    report("timeZone is required because a field is a date or datetime")
  }
  if (rowKey === undefined && !Object.hasOwn(fields, "id")) {
    report(
      'has no row key: add a field named "id" or name the identifying fields in rowKey'
    )
  } else {
    checkRowKey(rowKey === undefined ? "id" : rowKey, fields, report)
  }
}

function check(definition: unknown) {
  const problems: string[] = []
  const report = (message: string) => problems.push(message)
  if (!isRecord(definition)) {
    report("the definition must be an object")
    return problems
  }
  if (!itemIdSchema.safeParse(definition["id"]).success) {
    report(
      `id ${quote(definition["id"])} must start with a letter and contain only letters, digits, - and _, up to 64 characters`
    )
  }
  for (const key of Object.keys(definition)) {
    if (!datasetKeys.has(key)) {
      report(`unknown option ${quote(key)}`)
    }
  }
  const { describe, timeZone } = definition
  if (describe !== undefined && !isText(describe, 500)) {
    report("describe must be non-empty text of up to 500 characters")
  }
  if (timeZone !== undefined && !isTimeZoneName(timeZone)) {
    report(
      `timeZone ${quote(timeZone)} must be a region-based IANA time zone name, such as "Asia/Tokyo", or "UTC"`
    )
  }
  checkFields(definition, report)
  return problems
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function withoutUndefined(field: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(field).filter(([, value]) => value !== undefined)
  )
}

/**
 * Declares a dataset on the server: its fields, their types, units, formats
 * and capabilities, and the row key that identifies each row.
 *
 * The definition is read once, as plain data: its own enumerable
 * properties, with getters called once. The dataset keeps its own frozen
 * copy, so later changes to the definition don't reach it.
 *
 * The row key is `rowKey`, or else the field named `id`. Capabilities
 * default by type and can be overridden per field: every field is sortable,
 * filterable and readable by aggregate functions except `text` fields,
 * which are filterable by search only; `string`, `boolean`, `date` and
 * `enum` fields are groupable. The time zone must be a region-based IANA
 * name, such as `Asia/Tokyo`, or `UTC`, and is kept exactly as written.
 *
 * Throws a `TypeError` listing every problem: a bad dataset or field id, an
 * unknown type, unit, currency, time zone or option, text that is empty or
 * too long, a format that doesn't fit its field, bad enum values, or a
 * missing or invalid row key.
 *
 * @experimental
 */
export function defineDataset<
  const TFields extends Fields,
  const TKey extends KeyField<TFields> = "id" & KeyField<TFields>,
>(definition: DatasetDefinition<TFields, TKey>): Dataset<TFields, TKey> {
  const copy = snapshot(definition, depth, maxItems)
  const problems = check(copy)
  if (problems.length > 0 || !isRecord(copy) || !isRecord(copy["fields"])) {
    const id = isRecord(copy) ? copy["id"] : undefined
    const name = typeof id === "string" ? ` ${quote(id)}` : ""
    const shown = problems
      .slice(0, maxProblems)
      .map((problem) => `- ${problem}`)
    if (problems.length > maxProblems) {
      shown.push(`- …and ${String(problems.length - maxProblems)} more`)
    }
    throw new TypeError(`Invalid dataset${name}:\n${shown.join("\n")}`)
  }
  const { id, describe, timeZone, fields, rowKey } = copy
  const resolved = Object.fromEntries(
    Object.entries(fields).map(([fieldId, field]) => [
      fieldId,
      {
        ...defaultCapabilities(typeOf(field) as DatasetFieldType),
        ...withoutUndefined(isRecord(field) ? field : {}),
      },
    ])
  )
  // Checked above: the copy is a valid definition.
  return freeze({
    id,
    ...(describe === undefined ? {} : { describe }),
    timeZone: timeZone ?? "UTC",
    rowKey:
      rowKey === undefined ? ["id"] : Array.isArray(rowKey) ? rowKey : [rowKey],
    fields: resolved,
  }) as unknown as Dataset<TFields, TKey>
}
