import { formatSchema, itemIdSchema, type Format } from "@pliantui/contract"
import type { ExpressionField } from "@pliantui/core"

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
  readonly sortable?: boolean | undefined
  /** `"search"` allows text search only, not comparisons with a value. */
  readonly filterable?: boolean | "search" | undefined
  readonly groupable?: boolean | undefined
  /** Whether aggregate functions, such as `sum` or `countDistinct`, may read it. */
  readonly aggregatable?: boolean | undefined
}

interface FieldText extends DatasetFieldCapabilities {
  /** The field's name as people read it. */
  readonly label?: string | undefined
  /** What the field holds, for people and the model. */
  readonly describe?: string | undefined
}

type FormatOf<T extends Format["type"]> = Extract<Format, { type: T }>

/**
 * A dataset field. `currency` fields name their ISO 4217 currency, `number`
 * and `integer` fields can declare a unit, and `enum` fields list their
 * values.
 *
 * @experimental
 */
export type DatasetField =
  | (FieldText & {
      readonly type: "currency"
      readonly currency: string
      readonly format?: FormatOf<"currency"> | undefined
    })
  | (FieldText & {
      readonly type: "number" | "integer"
      /** A unit `Intl.NumberFormat` knows, such as `kilogram` or `kilometer-per-hour`. */
      readonly unit?: string | undefined
      readonly format?: FormatOf<"number"> | undefined
    })
  | (FieldText & {
      readonly type: "percent"
      readonly format?: FormatOf<"percent"> | undefined
    })
  | (FieldText & {
      readonly type: "date" | "datetime"
      readonly format?: FormatOf<"date"> | undefined
    })
  | (FieldText & {
      readonly type: "enum"
      readonly values: readonly [string, ...string[]]
    })
  | (FieldText & {
      readonly type: "string" | "text" | "boolean" | "id" | "url" | "email"
    })

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

const textTypes = new Set<DatasetFieldType>([
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

const fieldTypes = new Set<DatasetFieldType>([
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
])

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

function isText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  )
}

interface RawField {
  readonly [key: string]: unknown
  readonly type?: unknown
  readonly label?: unknown
  readonly describe?: unknown
  readonly currency?: unknown
  readonly unit?: unknown
  readonly values?: unknown
  readonly format?: unknown
}

function checkFormat(
  field: RawField,
  type: DatasetFieldType,
  report: (message: string) => void
) {
  const parsed = formatSchema.safeParse(field.format)
  if (!parsed.success || parsed.data.type !== formatTypes[type]) {
    report(`format must be a ${String(formatTypes[type])} format`)
    return
  }
  const format = parsed.data
  if (
    format.type === "currency" &&
    format.currency !== undefined &&
    format.currency !== field.currency
  ) {
    report(
      `format can't change the currency from ${JSON.stringify(field.currency)}`
    )
  }
  if (
    format.type === "number" &&
    format.unit !== undefined &&
    format.unit !== field.unit
  ) {
    report(
      field.unit === undefined
        ? "format can't add a unit; declare it as the field's unit"
        : `format can't change the unit from ${JSON.stringify(field.unit)}`
    )
  }
}

/**
 * Checks one field's definition and reports each problem, so a JavaScript
 * caller gets what TypeScript would have caught.
 */
export function checkField(
  id: string,
  field: unknown,
  report: (message: string) => void
) {
  const at = (message: string) => {
    report(`field "${id}": ${message}`)
  }
  if (!itemIdSchema.safeParse(id).success) {
    report(
      `field id "${id}" must start with a letter and contain only letters, digits, - and _, up to 64 characters`
    )
  }
  if (typeof field !== "object" || field === null || Array.isArray(field)) {
    at("must be an object")
    return
  }
  const record = field as RawField
  const type = [...fieldTypes].find((known) => known === record.type)
  if (type === undefined) {
    at(
      `unknown type ${JSON.stringify(record.type)}; use one of ${[...fieldTypes].join(", ")}`
    )
    return
  }
  const allowed = new Set([...commonKeys, ...(extraKeys[type] ?? [])])
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      at(`unknown option "${key}" for a ${type} field`)
    }
  }
  if (record.label !== undefined && !isText(record.label, 80)) {
    at("label must be non-empty text of up to 80 characters")
  }
  if (record.describe !== undefined && !isText(record.describe, 200)) {
    at("describe must be non-empty text of up to 200 characters")
  }
  for (const key of capabilityKeys) {
    const value = record[key]
    const search = key === "filterable" && value === "search"
    if (value !== undefined && typeof value !== "boolean" && !search) {
      at(
        `${key} must be a boolean${key === "filterable" ? ' or "search"' : ""}`
      )
    }
    if (search && !textTypes.has(type)) {
      at(`filterable: "search" needs a text field, not a ${type} field`)
    }
  }
  if (type === "currency") {
    const { currency } = record
    if (typeof currency !== "string" || !isKnown("currency", currency)) {
      at(
        `unknown currency ${JSON.stringify(currency)}; use an ISO 4217 code such as USD`
      )
    }
  }
  if (record.unit !== undefined) {
    const { unit } = record
    if (unit === "percent") {
      at('use the percent type instead of the unit "percent"')
    } else if (typeof unit !== "string" || !isKnown("unit", unit)) {
      at(
        `unknown unit ${JSON.stringify(unit)}; use a unit Intl.NumberFormat knows, such as kilogram or kilometer-per-hour`
      )
    }
  }
  if (type === "enum") {
    const { values } = record
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      !values.every((value) => typeof value === "string" && value.length > 0)
    ) {
      at("values must list at least one non-empty string")
    } else if (new Set(values).size !== values.length) {
      at("values must not repeat")
    }
  }
  if (record.format !== undefined && formatTypes[type] !== undefined) {
    checkFormat(record, type, at)
  }
}
