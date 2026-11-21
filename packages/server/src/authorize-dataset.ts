import { itemIdSchema } from "@pliantui/contract"

import type { Dataset, Fields } from "./define-dataset"
import { quote } from "./quote"
import { freeze, isRecord, snapshot } from "./snapshot"

type ScopeValue = string | number | boolean

/**
 * Conditions on a dataset's rows: a row matches when each key, a field or a
 * column the dataset's source knows, equals its value or one of its values.
 * A source rejects a key it doesn't know rather than skipping it. A key is
 * an id: a letter, then letters, digits, `-` and `_`. A value is JSON, so
 * convert a `bigint` first; lists don't nest.
 *
 * @experimental
 */
export type DatasetScope = Readonly<
  Record<string, ScopeValue | readonly ScopeValue[]>
>

/**
 * What a dataset's `scope(user)` returns to let that user load every row,
 * such as an administrator: `(user) => user.admin ? allRows : { orgId:
 * user.orgId }`. It is a symbol only this export holds, so a scope grants
 * every row only by returning it on purpose: no value read from a
 * database, a request or JSON can be it, and a missing value, `{}` or
 * anything else still throws.
 *
 * @experimental
 */
export const allRows: unique symbol = Symbol("allRows")

/**
 * What one user may load from a dataset. Whatever loads rows for the user
 * applies all of it, on every query, aggregate and load.
 *
 * @experimental
 */
export interface DatasetGrant {
  /**
   * The conditions every row loaded must match, ANDed with the query's own,
   * or `"all"` when the user may load every row: the dataset's scope is
   * `"public"`, or `scope(user)` returned `allRows`. A frozen copy of plain
   * JSON, so it can be part of a cache key.
   */
  readonly scope: DatasetScope | "all"
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
// conditions is an error. So is a scope that hides some of its conditions
// from the copy: a class instance's getters, symbol keys and non-enumerable
// properties.
function copyScope(scope: unknown, id: string): DatasetGrant["scope"] {
  if (scope === allRows) {
    return "all"
  }
  const copy = snapshot(scope, 2, Infinity)
  const entries = Object.entries(Object(copy) as object)
  if (
    !isRecord(scope) ||
    ![Object.prototype, null].includes(Reflect.getPrototypeOf(scope)) ||
    Reflect.ownKeys(scope).length !== entries.length ||
    entries.length === 0 ||
    !entries.every(([key, value]) => {
      const list = [value].flat()
      return (
        itemIdSchema.safeParse(key).success &&
        list.length > 0 &&
        list.every(isScopeValue)
      )
    })
  ) {
    throw new TypeError(
      `Dataset ${quote(id)}: scope(user) must return allRows or conditions by id, each a string, finite number, boolean or non-empty list of them`
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
 * Only `true` from an `access` function allows, and `access` is checked
 * before `scope` runs. Both are synchronous: look up what they need, such
 * as the user's organizations, before calling. The grant's scope is `"all"`
 * for a `"public"` dataset and when `scope` returns `allRows`. Throws a
 * `TypeError` when `scope` returns anything but `allRows` or a plain object
 * of one or more conditions, each named by an id and a string, finite
 * number, boolean or non-empty list of them, so a missing value, an empty
 * object or a condition a copy would lose can't widen the scope. Errors
 * thrown by `scope` or `access` are passed on.
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
    scope: scope === "public" ? "all" : copyScope(scope(user), id),
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
