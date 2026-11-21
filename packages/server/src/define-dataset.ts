import { itemIdSchema } from "@pliantui/contract"

import type { allRows, DatasetScope } from "./authorize-dataset"
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
import { freeze, isRecord, snapshot } from "./snapshot"

export type Fields<TUser = never> = Readonly<
  Record<string, DatasetField<DatasetFieldType, TUser>>
>

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
  {
    [K in keyof TFields]: TFields[K] extends {
      readonly type: "date" | "datetime"
    }
      ? K
      : never
  }[keyof TFields],
] extends [never]
  ? {
      /**
       * The time zone dates and datetimes are read in: `UTC` or an
       * Area/Location name, kept as written. Defaults to `UTC`.
       */
      readonly timeZone?: string | undefined
    }
  : {
      /**
       * The time zone dates and datetimes are read in: `UTC` or an
       * Area/Location name such as `Asia/Tokyo`, kept as written. Required
       * with a date or datetime field.
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
  TUser = never,
> = {
  /** The dataset's id, such as `orders`. */
  readonly id: string
  /** What the dataset holds, for people and the model: up to 500 characters. */
  readonly describe?: string | undefined
  /** The fields, by id, in the order they are listed. */
  readonly fields: TFields & ExactFields<TFields>
  /**
   * The rows a user may load, as conditions every query, aggregate and load
   * must match, such as `(user) => ({ orgId: user.orgId })`. `"public"`
   * lets every user load every row; a function returns `allRows` to let one
   * user, such as an administrator, load every row. Anything else, such as
   * `undefined` or `{}`, throws. Synchronous: look up what it needs, such as
   * the user's organizations, before calling `authorizeDataset`.
   */
  readonly scope: "public" | ((user: TUser) => DatasetScope | typeof allRows)
  /**
   * Whether a user may use the dataset at all. Only `true` allows it.
   * Synchronous, and checked before `scope` runs.
   */
  readonly access?: ((user: TUser) => boolean) | undefined
  readonly privacy?:
    | {
        /**
         * The fewest rows an aggregate may summarize. Aggregates over a
         * smaller group are suppressed, so single values can't be worked
         * out from them. Defaults to 1.
         */
        readonly minGroupSize?: number | undefined
      }
    | undefined
} & RowKeyOption<TFields, TKey> &
  TimeZoneOption<TFields>

type ResolvedField<TField extends DatasetField> = TField extends unknown
  ? {
      readonly [
        K in keyof TField as K extends keyof DatasetFieldCapabilities
          ? never
          : K
      ]: K extends "access" ? TField[K] : Readonly<TField[K]>
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
 * `createRowEvaluator` as they are. They include fields a user can't read
 * and fields hidden from the model, so to check a user's or the model's
 * expressions with `createExpressionChecker`, pass the `fields` of
 * `describeDataset(dataset, { user, audience })` instead.
 *
 * @experimental
 */
export interface Dataset<
  TFields extends Fields = Fields,
  TKey extends string = string,
  TUser = never,
> {
  readonly id: string
  readonly describe?: string
  /** The IANA name of the dataset's time zone, exactly as written. */
  readonly timeZone: string
  readonly rowKey: readonly [TKey, ...TKey[]]
  readonly fields: { readonly [K in keyof TFields]: ResolvedField<TFields[K]> }
  /** Use `authorizeDataset`, which checks what this returns. */
  readonly scope: "public" | ((user: TUser) => DatasetScope | typeof allRows)
  readonly access?: (user: TUser) => boolean
  readonly privacy: { readonly minGroupSize: number }
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

const datasetKeys = new Set([
  "id",
  "describe",
  "timeZone",
  "fields",
  "rowKey",
  "scope",
  "access",
  "privacy",
])

// Objects, then fields, then each field, then its format and values.
const depth = 4

// One more than any list's limit, so a longer list is still reported.
const maxItems = 101

const maxProblems = 20

const maxRowKey = 10

// Runtimes accept abbreviations such as `BST` and `IST`, which name
// different zones in different places, so only `UTC` and Area/Location
// names are allowed. `Etc/` and `SystemV/` names are fixed offsets, which
// mislead wherever clocks change.
const nonRegionArea = /^(?:etc|systemv)\//i

/**
 * Whether a time zone is `UTC`, in any case, or an Area/Location name, such
 * as `Asia/Tokyo`, that `Intl` accepts. The name is kept as written, not
 * replaced by the one `Intl` resolves it to, which depends on the runtime's
 * time zone data: some resolve `Asia/Kolkata` to its older name
 * `Asia/Calcutta`.
 */
function isTimeZoneName(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string") {
    return false
  }
  if (timeZone.toUpperCase() === "UTC") {
    return true
  }
  if (!timeZone.includes("/") || nonRegionArea.test(timeZone)) {
    return false
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone })
    return true
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
    } else if (
      isRecord(fields[key]) &&
      (fields[key]["access"] !== undefined ||
        fields[key]["exposeToAI"] === false)
    ) {
      // Whoever may read a row, the model included, must be able to tell
      // rows apart.
      report(`rowKey field ${quote(key)} can't set access or exposeToAI: false`)
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
  const { describe, timeZone, scope, access, privacy } = definition
  if (scope !== "public" && typeof scope !== "function") {
    report('scope must be "public" or a function')
  }
  if (access !== undefined && typeof access !== "function") {
    report("access must be a function")
  }
  const { minGroupSize = 1, ...rest } = isRecord(privacy) ? privacy : {}
  if (
    (privacy !== undefined && !isRecord(privacy)) ||
    Object.keys(rest).length > 0 ||
    !Number.isSafeInteger(minGroupSize) ||
    Number(minGroupSize) < 1
  ) {
    report("privacy must be { minGroupSize: n }, a whole number of at least 1")
  }
  if (describe !== undefined && !isText(describe, 500)) {
    report("describe must be non-empty text of up to 500 characters")
  }
  if (timeZone !== undefined && !isTimeZoneName(timeZone)) {
    report(
      `timeZone ${quote(timeZone)} must be "UTC" or an Area/Location time zone name, such as "Asia/Tokyo"`
    )
  }
  checkFields(definition, report)
  return problems
}

function withoutUndefined(field: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(field).filter(([, value]) => value !== undefined)
  )
}

/**
 * Declares a dataset on the server: its fields, their types, units, formats
 * and capabilities, the row key that identifies each row, and who may load
 * which rows and fields.
 *
 * The definition is read once, as plain data: its own enumerable
 * properties, with getters called once. The dataset keeps its own frozen
 * copy, so later changes to the definition don't reach it.
 *
 * The row key is `rowKey`, or else the field named `id`. Capabilities
 * default by type and can be overridden per field: every field is sortable,
 * filterable and readable by aggregate functions except `text` fields,
 * which are filterable by search only; `string`, `boolean`, `date` and
 * `enum` fields are groupable. The time zone must be `UTC` or an
 * Area/Location name such as `Asia/Tokyo`, and is kept exactly as written.
 *
 * Every dataset declares its row `scope`: a function of the user, which
 * returns conditions or `allRows`, or `"public"`. `access` on the dataset
 * or a field restricts who may use it, and `exposeToAI: false` keeps a
 * field from the model. `authorizeDataset` resolves all of them for one
 * user.
 *
 * Throws a `TypeError` listing every problem: a bad dataset or field id, an
 * unknown type, unit, currency, time zone or option, text that is empty or
 * too long, a format that doesn't fit its field, bad enum values, a
 * missing or invalid row key, a row key field that sets `access` or
 * `exposeToAI: false`, a missing scope, an `access`, on the dataset or a
 * field, that isn't a function, `privacy` that isn't `{ minGroupSize }` with
 * a whole number of at least 1, or an `exposeToAI` that isn't a boolean.
 *
 * @experimental
 */
export function defineDataset<
  TUser,
  const TFields extends Fields<TUser>,
  const TKey extends KeyField<TFields> = "id" & KeyField<TFields>,
>(
  definition: DatasetDefinition<TFields, TKey, TUser>
): Dataset<TFields, TKey, TUser> {
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
  const { id, describe, timeZone, fields, rowKey, scope, access, privacy } =
    copy
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
    scope,
    ...(access === undefined ? {} : { access }),
    privacy: {
      minGroupSize: 1,
      ...withoutUndefined(isRecord(privacy) ? privacy : {}),
    },
  }) as unknown as Dataset<TFields, TKey, TUser>
}
