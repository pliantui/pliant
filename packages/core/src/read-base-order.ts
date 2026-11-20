import {
  collectionSchema,
  itemIdSchema,
  nodeIdSchema,
} from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import { checkPrimaries, type ReadFlags } from "./read-flags"

const isId = (id: unknown, item: boolean) =>
  (item ? itemIdSchema : nodeIdSchema).safeParse(id).success

const isIds = (ids: unknown, item: boolean): ids is string[] =>
  Array.isArray(ids) && ids.every((id) => isId(id, item))

const itemCollections = new Set<string>(
  collectionSchema.exclude(["slots"]).options
)

/**
 * Checks `baseOrder` and reads it as a map of action group to its members in
 * render order: a node id to its children's ids, or `<node>/<collection>`,
 * such as `orders-toolbar/actions`, to its item ids. `baseParents` is the
 * node tree as read, if given. `name` names the option in errors.
 *
 * Throws a `TypeError` unless it is a plain object that maps node ids to
 * arrays of node ids and `<node>/<collection>` keys to arrays of item ids,
 * lists each child once, and puts each child in the parent that
 * `baseParents`, or else the child's flag address, shows. With
 * `baseParents`, every node it names must be in it. With the parents it
 * lists, two primary actions can't share a group.
 */
export function readBaseOrder(
  baseOrder: unknown,
  baseParents: ReadonlyMap<string, string | null> | undefined,
  flags: ReadFlags | undefined,
  name = "baseOrder"
): Map<string, readonly string[]> | undefined {
  if (baseOrder === undefined) {
    return undefined
  }
  if (!isPlainObject(baseOrder)) {
    throw new TypeError(`${name} must be a plain object of children by node id`)
  }
  const read = new Map<string, readonly string[]>()
  const parents = new Map<string, string | null>(baseParents ?? flags?.parents)
  for (const [key, children] of Object.entries(baseOrder)) {
    const [node, collection, ...rest] = key.split("/")
    const items = collection !== undefined
    if (
      !isId(node, false) ||
      rest.length > 0 ||
      (items && !itemCollections.has(collection)) ||
      !isIds(children, items)
    ) {
      throw new TypeError(`${name}["${key}"] must be an array of ids`)
    }
    const ids = children
    for (const id of [node ?? key, ...(items ? [] : ids)]) {
      if (baseParents && !baseParents.has(id)) {
        throw new TypeError(`${name} names ${id}, which isn't in the node tree`)
      }
    }
    if (new Set(ids).size < ids.length) {
      throw new TypeError(`${name}["${key}"] lists a child more than once`)
    }
    if (!items) {
      for (const child of ids) {
        const shown = parents.get(child)
        if (shown !== undefined && shown !== key) {
          throw new TypeError(
            `${name} lists ${child} in ${key}, but its parent is ${String(shown)}`
          )
        }
        parents.set(child, key)
      }
    }
    read.set(key, ids)
  }
  checkPrimaries(flags?.flags, parents, name)
  return read
}
