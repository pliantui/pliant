import type { Dataset, Fields } from "./define-dataset"
import { quote } from "./quote"
import { freeze, isRecord, snapshot } from "./snapshot"

type ScopeValue = string | number | boolean

/**
 * Conditions on a dataset's rows: a row matches when each key, a field or a
 * column the dataset's source knows, equals its value or one of its values.
 * A source rejects a key it doesn't know rather than skipping it.
 *
 * @experimental
 */
export type DatasetScope = Readonly<
  Record<string, ScopeValue | readonly [ScopeValue, ...ScopeValue[]]>
>

/**
 * What one user may load from a dataset. Whatever loads rows for the user
 * applies all of it, on every query, aggregate and load.
 *
 * @experimental
 */
export interface DatasetGrant {
  /**
   * The conditions every row loaded must match, ANDed with the query's own,
   * or `"public"` when the dataset lets every user load every row. A frozen
   * copy of plain JSON, so it can be part of a cache key.
   */
  readonly scope: DatasetScope | "public"
  /** The fields the user may read, in the dataset's order. Load no others. */
  readonly fields: readonly string[]
  /** The fewest rows an aggregate may summarize; suppress smaller groups. */
  readonly minGroupSize: number
}

function isScopeValue(value: unknown) {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    Number.isFinite(value)
  )
}

// A missing value, such as `user.orgId` on a user without one, must not
// drop its condition and widen the scope, so anything but a complete set of
// conditions is an error.
function copyScope(scope: unknown, id: string) {
  const copy = snapshot(scope, 2, Infinity)
  const values = isRecord(copy) ? Object.values(copy) : []
  if (
    values.length === 0 ||
    !values.every((value) => {
      const list = [value].flat()
      return list.length > 0 && list.every(isScopeValue)
    })
  ) {
    throw new TypeError(
      `Dataset ${quote(id)}: scope(user) must return conditions, each a string, finite number, boolean or non-empty list of them`
    )
  }
  // Checked above: every condition is a scope value or a list of them.
  return copy as DatasetScope
}

// Only `true` allows, so an `access` written in JavaScript that returns a
// truthy value or a promise doesn't.
function allows<TUser>(
  access: ((user: TUser) => unknown) | undefined,
  user: TUser
) {
  return access === undefined || access(user) === true
}

/**
 * Resolves what one user may load from a dataset: its row scope, the fields
 * they may read and the smallest group an aggregate may cover. Returns
 * `null` when the dataset's `access` doesn't allow the user.
 *
 * Only `true` from an `access` function allows. Throws a `TypeError` when
 * `scope` returns anything but one or more conditions, each a string,
 * finite number, boolean or non-empty list of them, so a missing value
 * can't widen the scope. Errors thrown by `scope` or `access` are passed on.
 *
 * @experimental
 */
export function authorizeDataset<TUser>(
  dataset: Dataset<Fields, string, TUser>,
  user: TUser
): DatasetGrant | null {
  const { id, access, scope, fields, privacy } = dataset
  if (!allows(access, user)) {
    return null
  }
  return freeze({
    scope: scope === "public" ? scope : copyScope(scope(user), id),
    fields: Object.keys(fields).filter((field) =>
      // `defineDataset` typed each field's `access` with the dataset's user.
      allows(
        fields[field]?.access as ((user: TUser) => unknown) | undefined,
        user
      )
    ),
    minGroupSize: privacy.minGroupSize,
  })
}
