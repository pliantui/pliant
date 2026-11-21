import { authorizeDataset } from "./authorize-dataset"
import type { DatasetField } from "./dataset-field"
import type { Dataset, Fields } from "./define-dataset"
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
export interface DescribeDatasetOptions<TUser = never> {
  /**
   * Who reads the descriptor: `client`, the browser, or `ai`, the model.
   * The model's leaves out fields with `exposeToAI: false`.
   */
  readonly audience: "client" | "ai"
  /** The user the descriptor is for, as the dataset's `access` and `scope` take it. */
  readonly user: TUser
}

/**
 * Returns the public descriptor of a dataset for one user and audience:
 * fresh JSON-safe objects that name only the fields that user may read, and
 * only what that audience may know about each. Returns `null` when the
 * dataset's `access` doesn't allow the user.
 *
 * It checks the user's row scope as `authorizeDataset` does, and throws
 * what that throws.
 *
 * @experimental
 */
export function describeDataset<TUser>(
  dataset: Dataset<Fields, string, TUser>,
  options: DescribeDatasetOptions<TUser>
): DatasetDescriptor | null {
  const audience: unknown = Reflect.get(Object(options), "audience")
  if (!audiences.includes(audience)) {
    throw new TypeError(
      `audience must be "client" or "ai", not ${quote(audience)}`
    )
  }
  const grant = authorizeDataset(dataset, options.user)
  if (grant === null) {
    return null
  }
  const fields = Object.entries(dataset.fields)
    .filter(
      ([id, field]) =>
        grant.fields.includes(id) && (audience === "client" || field.exposeToAI)
    )
    .map(([id, field]) => [
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
