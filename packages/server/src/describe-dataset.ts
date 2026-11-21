import type { DatasetField } from "./dataset-field"
import type { Dataset } from "./define-dataset"
import { quote } from "./quote"

const publicKeys = [
  "type",
  "label",
  "describe",
  "currency",
  "unit",
  "values",
  "format",
  "sortable",
  "filterable",
  "groupable",
  "aggregatable",
] as const

type PublicKey = (typeof publicKeys)[number]

type Capabilities = "sortable" | "filterable" | "groupable" | "aggregatable"

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

type PublicField<TField> = TField extends unknown
  ? Mutable<Pick<TField, Exclude<PublicKey, Capabilities> & keyof TField>> &
      Required<{
        -readonly [K in Capabilities & keyof TField]: Exclude<
          TField[K],
          undefined
        >
      }>
  : never

/**
 * A field as clients and the model see it: its type, unit, format, text and
 * resolved capabilities.
 *
 * @experimental
 */
export type DatasetFieldDescriptor = PublicField<DatasetField>

/**
 * What clients and the model are told about a dataset. It is plain JSON and
 * carries only what is public about each field.
 *
 * @experimental
 */
export interface DatasetDescriptor {
  id: string
  describe?: string
  timeZone: string
  /** The fields that identify a row, in order. */
  rowKey: string[]
  /** The fields, by id, in the order the dataset lists them. */
  fields: Record<string, DatasetFieldDescriptor>
}

const audiences: readonly unknown[] = ["client", "ai"]

/**
 * Options for `describeDataset`.
 *
 * @experimental
 */
export interface DescribeDatasetOptions {
  /**
   * Who reads the descriptor: `client`, the browser, or `ai`, the model.
   * Both currently get the same descriptor.
   */
  readonly audience: "client" | "ai"
}

/**
 * Returns the public descriptor of a dataset for one audience: fresh
 * JSON-safe objects that name only what that audience may know about each
 * field.
 *
 * @experimental
 */
export function describeDataset(
  dataset: Dataset,
  options: DescribeDatasetOptions
): DatasetDescriptor {
  const audience: unknown = Reflect.get(Object(options), "audience")
  if (!audiences.includes(audience)) {
    throw new TypeError(
      `audience must be "client" or "ai", not ${quote(audience)}`
    )
  }
  const fields = Object.entries(dataset.fields).map(([id, field]) => [
    id,
    Object.fromEntries(
      publicKeys.flatMap((key) =>
        Object.hasOwn(field, key)
          ? [[key, structuredClone(Reflect.get(field, key))]]
          : []
      )
    ),
  ])
  return {
    id: dataset.id,
    ...(dataset.describe === undefined ? {} : { describe: dataset.describe }),
    timeZone: dataset.timeZone,
    rowKey: [...dataset.rowKey],
    // Built from a checked dataset's own fields, key by key.
    fields: Object.fromEntries(fields) as DatasetDescriptor["fields"],
  }
}
