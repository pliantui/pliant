import { formatSchema, itemIdSchema, type Format } from "@pliantui/contract"
import type { ExpressionField } from "@pliantui/core"

import { isRecord } from "./snapshot"

/**
 * A field's type. Values of `text` fields are long-form text, such as notes;
 * `percent` values are fractions (0.25 is 25%).
 *
 * @experimental
 */
export type DatasetFieldType = ExpressionField["type"]

/**
 * What a field allows. Each defaults by the field's type (see
 * `defineDataset`); set one to override it.
 *
 * @experimental
 */
export interface DatasetFieldCapabilities {
  /**
   * Whether people and the model can sort by the field. An `enum` field
   * sorts by its text, like a `string` field, not by the order of its
   * `values`.
   */
  readonly sortable?: boolean | undefined
  /**
   * Whether people and the model can filter by the field. `true` allows
   * every filter its type supports, text search included; `"search"`, on a
   * text-valued field (`string`, `text`, `enum`, `id`, `url` or `email`),
   * allows text search only.
   */
  readonly filterable?: boolean | "search" | undefined
  /** Whether rows can be grouped by the field. */
  readonly groupable?: boolean | undefined
  /** Whether aggregate functions, such as `sum` or `countDistinct`, may read it. */
  readonly aggregatable?: boolean | undefined
}

interface FieldText extends DatasetFieldCapabilities {
  /** The field's name as people read it: up to 80 characters. */
  readonly label?: string | undefined
  /** What the field holds, for people and the model: up to 200 characters. */
  readonly describe?: string | undefined
}

type FormatOf<T extends Format["type"]> = Extract<Format, { type: T }>

interface NumberOptions {
  /**
   * A unit `Intl.NumberFormat` knows, such as `kilogram` or
   * `kilometer-per-hour`. Use the `percent` type for percentages.
   */
  readonly unit?: string | undefined
  /** Its `unit`, if set, must be the field's. */
  readonly format?: FormatOf<"number"> | undefined
}

interface FieldOptions {
  readonly currency: {
    /** An ISO 4217 code, such as `USD`. */
    readonly currency: string
    /** Its `currency`, if set, must be the field's. */
    readonly format?: FormatOf<"currency"> | undefined
  }
  readonly number: NumberOptions
  readonly integer: NumberOptions
  readonly percent: { readonly format?: FormatOf<"percent"> | undefined }
  readonly date: {
    /** A calendar date has no time of day to show, so `time` can't be set. */
    readonly format?:
      (FormatOf<"date"> & { readonly time?: false | undefined }) | undefined
  }
  readonly datetime: { readonly format?: FormatOf<"date"> | undefined }
  readonly enum: {
    /** Up to 100 distinct values of up to 80 characters each. */
    readonly values: readonly [string, ...string[]]
  }
}

type OptionsOf<T extends DatasetFieldType> = T extends keyof FieldOptions
  ? FieldOptions[T]
  : unknown

/**
 * A dataset field: its type, and the options that type takes. `currency`
 * fields name their currency, `number` and `integer` fields can declare a
 * unit, and `enum` fields list their values.
 *
 * @experimental
 */
export type DatasetField<T extends DatasetFieldType = DatasetFieldType> =
  T extends DatasetFieldType
    ? FieldText & { readonly type: T } & OptionsOf<T>
    : never

/** The options a field of type `T` takes. */
export type FieldKey<T extends DatasetFieldType> =
  "type" | keyof FieldText | keyof OptionsOf<T>

type Capabilities = Required<{
  [K in keyof DatasetFieldCapabilities]-?: Exclude<
    DatasetFieldCapabilities[K],
    undefined
  >
}>

const formatTypes: Partial<Record<DatasetFieldType, Format["type"]>> = {
  currency: "currency",
  number: "number",
  integer: "number",
  percent: "percent",
  date: "date",
  datetime: "date",
}

const searchableTypes = new Set<DatasetFieldType>([
  "string",
  "text",
  "enum",
  "id",
  "url",
  "email",
])

const groupableTypes = new Set<DatasetFieldType>([
  "string",
  "boolean",
  "date",
  "enum",
])

const fieldTypes: readonly DatasetFieldType[] = [
  "string",
  "text",
  "number",
  "integer",
  "currency",
  "percent",
  "boolean",
  "date",
  "datetime",
  "enum",
  "id",
  "url",
  "email",
]

const capabilityKeys = [
  "sortable",
  "filterable",
  "groupable",
  "aggregatable",
] as const

const commonKeys = ["type", "label", "describe", ...capabilityKeys]

const extraKeys: Partial<Record<DatasetFieldType, readonly string[]>> = {
  currency: ["currency", "format"],
  number: ["unit", "format"],
  integer: ["unit", "format"],
  percent: ["format"],
  date: ["format"],
  datetime: ["format"],
  enum: ["values"],
}

const quote = (value: unknown) =>
  value === undefined ? "undefined" : JSON.stringify(value)

/** The capabilities a field of this type has unless it overrides them. */
export function defaultCapabilities(type: DatasetFieldType): Capabilities {
  const text = type === "text"
  return {
    sortable: !text,
    filterable: text ? "search" : true,
    groupable: groupableTypes.has(type),
    aggregatable: !text,
  }
}

/** Whether `value` is text with something besides spaces, up to `max` characters. */
export function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= max
}

function isKnown(kind: "currency" | "unit", value: string) {
  try {
    return kind === "currency"
      ? Intl.supportedValuesOf("currency").includes(value)
      : new Intl.NumberFormat("en", {
          style: "unit",
          unit: value,
        }).resolvedOptions().unit === value
  } catch {
    return false
  }
}

function checkFormat(
  field: Readonly<Record<string, unknown>>,
  type: DatasetFieldType,
  report: (message: string) => void
) {
  const parsed = formatSchema.safeParse(field["format"])
  if (!parsed.success || parsed.data.type !== formatTypes[type]) {
    report(`format must be a ${quote(formatTypes[type])} format`)
    return
  }
  const format = parsed.data
  if (format.type === "date" && format.time === true && type === "date") {
    report("format can't show a time for a date field, which has none")
  }
  if (
    format.type === "currency" &&
    format.currency !== undefined &&
    format.currency !== field["currency"]
  ) {
    report(`format can't change the currency from ${quote(field["currency"])}`)
  }
  if (
    format.type === "number" &&
    format.unit !== undefined &&
    format.unit !== field["unit"]
  ) {
    report(
      field["unit"] === undefined
        ? "format can't add a unit; declare it as the field's unit"
        : `format can't change the unit from ${quote(field["unit"])}`
    )
  }
}

function checkValues(values: unknown, report: (message: string) => void) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 100 ||
    !values.every((value) => isText(value, 80))
  ) {
    report(
      "values must list 1 to 100 values, each non-empty text of up to 80 characters"
    )
  } else if (new Set(values).size !== values.length) {
    report("values must not repeat")
  }
}

/**
 * Checks one field's definition, a snapshot of plain data, and reports each
 * problem, so a JavaScript caller gets what TypeScript would have caught.
 */
export function checkField(
  id: string,
  field: unknown,
  report: (message: string) => void
) {
  const at = (message: string) => {
    report(`field ${quote(id)}: ${message}`)
  }
  if (!itemIdSchema.safeParse(id).success) {
    report(
      `field id ${quote(id)} must start with a letter and contain only letters, digits, - and _, up to 64 characters`
    )
  }
  if (!isRecord(field)) {
    at("must be an object")
    return
  }
  const type = fieldTypes.find((known) => known === field["type"])
  if (type === undefined) {
    at(
      `unknown type ${quote(field["type"])}; use one of ${fieldTypes.join(", ")}`
    )
    return
  }
  const allowed = new Set([...commonKeys, ...(extraKeys[type] ?? [])])
  for (const key of Object.keys(field)) {
    if (!allowed.has(key)) {
      at(`unknown option ${quote(key)} for a ${type} field`)
    }
  }
  if (field["label"] !== undefined && !isText(field["label"], 80)) {
    at("label must be non-empty text of up to 80 characters")
  }
  if (field["describe"] !== undefined && !isText(field["describe"], 200)) {
    at("describe must be non-empty text of up to 200 characters")
  }
  for (const key of capabilityKeys) {
    const value = field[key]
    const search = key === "filterable" && value === "search"
    if (value !== undefined && typeof value !== "boolean" && !search) {
      at(
        `${key} must be a boolean${key === "filterable" ? ' or "search"' : ""}`
      )
    }
    if (search && !searchableTypes.has(type)) {
      at(`filterable: "search" needs a text-valued field, not a ${type} field`)
    }
  }
  if (type === "currency") {
    const currency = field["currency"]
    if (typeof currency !== "string" || !isKnown("currency", currency)) {
      at(
        `unknown currency ${quote(currency)}; use an ISO 4217 code such as "USD"`
      )
    }
  }
  const unit = field["unit"]
  if (unit !== undefined && allowed.has("unit")) {
    if (unit === "percent") {
      at('use the percent type instead of the unit "percent"')
    } else if (typeof unit !== "string" || !isKnown("unit", unit)) {
      at(
        `unknown unit ${quote(unit)}; use a unit Intl.NumberFormat knows, such as "kilogram" or "kilometer-per-hour"`
      )
    }
  }
  if (type === "enum") {
    checkValues(field["values"], at)
  }
  if (field["format"] !== undefined && allowed.has("format")) {
    checkFormat(field, type, at)
  }
}
