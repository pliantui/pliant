import { itemIdSchema } from "@pliantui/contract"

import {
  checkField,
  defaultCapabilities,
  type DatasetField,
  type DatasetFieldCapabilities,
} from "./dataset-field"

type Fields = Readonly<Record<string, DatasetField>>

type KeyOf<TFields extends Fields> = keyof TFields & string

type RowKeyOption<
  TFields extends Fields,
  TKey extends KeyOf<TFields>,
> = "id" extends keyof TFields
  ? {
      /** The field, or fields in order, that identify a row. Defaults to `id`. */
      readonly rowKey?: TKey | readonly [TKey, ...TKey[]] | undefined
    }
  : {
      /** The field, or fields in order, that identify a row. */
      readonly rowKey: TKey | readonly [TKey, ...TKey[]]
    }

/**
 * What `defineDataset` takes.
 *
 * @experimental
 */
export type DatasetDefinition<
  TFields extends Fields = Fields,
  TKey extends KeyOf<TFields> = KeyOf<TFields>,
> = {
  /** The dataset's id, such as `orders`. */
  readonly id: string
  /** What the dataset holds, for people and the model. */
  readonly describe?: string | undefined
  /**
   * The IANA time zone dates and datetimes are read in, such as
   * `Asia/Kolkata`. Required when a field is a date or datetime; otherwise
   * it defaults to `UTC`.
   */
  readonly timeZone?: string | undefined
  /** The fields, by id, in the order they are listed. */
  readonly fields: TFields
} & RowKeyOption<TFields, TKey>

type ResolvedField<TField extends DatasetField> = Omit<
  TField,
  keyof DatasetFieldCapabilities
> &
  Required<{
    [K in keyof DatasetFieldCapabilities]-?: Exclude<
      DatasetFieldCapabilities[K],
      undefined
    >
  }>

/**
 * A checked dataset. Its fields carry every capability, resolved from their
 * type's defaults and their own overrides, and feed core's
 * `createExpressionChecker` and `createRowEvaluator` as they are.
 *
 * @experimental
 */
export interface Dataset<
  TFields extends Fields = Fields,
  TKey extends KeyOf<TFields> = KeyOf<TFields>,
> {
  readonly id: string
  readonly describe?: string
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

const keyTypes = new Set(["id", "string", "integer", "email", "url"])

const datasetKeys = new Set(["id", "describe", "timeZone", "fields", "rowKey"])

function isTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone })
    return true
  } catch {
    return false
  }
}

function checkRowKey(
  rowKey: readonly unknown[],
  fields: object,
  report: (message: string) => void
) {
  if (rowKey.length === 0) {
    report("rowKey must name at least one field")
  }
  if (new Set(rowKey).size !== rowKey.length) {
    report("rowKey must not name a field twice")
  }
  for (const key of rowKey) {
    const field: unknown =
      typeof key === "string" && Object.hasOwn(fields, key)
        ? Reflect.get(fields, key)
        : undefined
    if (field === undefined) {
      report(`rowKey names ${JSON.stringify(key)}, which isn't a field`)
    } else if (!keyTypes.has(typeOf(field))) {
      report(
        `rowKey field ${JSON.stringify(key)} must be an id, string, integer, email or url field`
      )
    }
  }
}

function typeOf(field: unknown) {
  return typeof field === "object" && field !== null
    ? String(Reflect.get(field, "type"))
    : ""
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/**
 * Declares a dataset on the server: its fields, their types, units, formats
 * and capabilities, and the row key that identifies each row and breaks
 * ties when rows are sorted.
 *
 * The row key is `rowKey`, or else the field named `id`. Capabilities
 * default by type and can be overridden per field: every field is sortable
 * and filterable except `text` fields, which are filterable by search only;
 * `string`, `boolean`, `date` and `enum` fields are groupable; and aggregate
 * functions can read every field except `text` fields.
 *
 * Throws a `TypeError` listing every problem: a bad dataset or field id, an
 * unknown type, unit, currency, time zone or option, a format that doesn't
 * fit its field, or a missing or invalid row key.
 *
 * @experimental
 */
export function defineDataset<
  const TFields extends Fields,
  const TKey extends KeyOf<TFields> = "id" & KeyOf<TFields>,
>(definition: DatasetDefinition<TFields, TKey>): Dataset<TFields, TKey> {
  const problems: string[] = []
  const report = (message: string) => problems.push(message)
  // Read as unknown: JavaScript callers can pass anything.
  const {
    id,
    describe,
    timeZone,
    fields,
    rowKey,
  }: Partial<Record<keyof DatasetDefinition | "rowKey", unknown>> = definition
  const name = typeof id === "string" ? id : "(no id)"
  if (!itemIdSchema.safeParse(id).success) {
    report(
      `id ${JSON.stringify(id)} must start with a letter and contain only letters, digits, - and _, up to 64 characters`
    )
  }
  for (const key of Object.keys(definition)) {
    if (!datasetKeys.has(key)) {
      report(`unknown option "${key}"`)
    }
  }
  if (
    describe !== undefined &&
    (typeof describe !== "string" || describe.trim() === "")
  ) {
    report("describe must be non-empty text")
  }
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    report("fields must be an object of fields by id")
  } else {
    const ids = Object.keys(fields)
    if (ids.length === 0) {
      report("fields must declare at least one field")
    }
    for (const fieldId of ids) {
      checkField(fieldId, Reflect.get(fields, fieldId), report)
    }
    const timed = Object.values(fields).some((field: unknown) =>
      ["date", "datetime"].includes(typeOf(field))
    )
    if (timeZone === undefined && timed) {
      report("timeZone is required because a field is a date or datetime")
    }
    if (rowKey === undefined && !Object.hasOwn(fields, "id")) {
      report(
        'has no row key: add a field named "id" or name the identifying fields in rowKey'
      )
    } else {
      checkRowKey(
        Array.isArray(rowKey) ? rowKey : [rowKey ?? "id"],
        fields,
        report
      )
    }
  }
  if (
    timeZone !== undefined &&
    (typeof timeZone !== "string" || !isTimeZone(timeZone))
  ) {
    report(`unknown time zone ${JSON.stringify(timeZone)}`)
  }
  if (problems.length > 0) {
    throw new TypeError(
      `Invalid dataset "${name}":\n${problems.map((problem) => `- ${problem}`).join("\n")}`
    )
  }

  // Checked above: every field is valid and the row key names real fields.
  const resolved = Object.fromEntries(
    Object.entries(definition.fields).map(([fieldId, field]) => [
      fieldId,
      {
        ...defaultCapabilities(field.type),
        ...structuredClone(defined(field)),
      },
    ])
  )
  return deepFreeze({
    id: name,
    ...(definition.describe === undefined
      ? {}
      : { describe: definition.describe }),
    timeZone: definition.timeZone ?? "UTC",
    rowKey: Array.isArray(rowKey) ? rowKey.slice() : [rowKey ?? "id"],
    fields: resolved,
  }) as unknown as Dataset<TFields, TKey>
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>
}
