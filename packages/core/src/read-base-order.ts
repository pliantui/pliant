import { nodeIdSchema } from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import type { ReadFlags } from "./read-flags"

const isNodeId = (id: unknown) => nodeIdSchema.safeParse(id).success

const isNodeIds = (ids: unknown): ids is string[] =>
  Array.isArray(ids) && ids.every(isNodeId)

/**
 * Checks `baseOrder` and reads it as a map of node id to its children in
 * render order. `baseParents` is the node tree as read, if given. `name`
 * names the option in errors.
 *
 * Throws a `TypeError` unless it is a plain object that maps node ids to
 * arrays of node ids, lists each child once, and puts each child in the
 * parent that `baseParents`, or else the child's flag address, shows. With
 * `baseParents`, every node it names must be in it.
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
  const listed = new Set<string>()
  for (const [parent, children] of Object.entries(baseOrder)) {
    if (!isNodeId(parent) || !isNodeIds(children)) {
      throw new TypeError(`${name}["${parent}"] must be an array of node ids`)
    }
    for (const id of [parent, ...children]) {
      if (baseParents && !baseParents.has(id)) {
        throw new TypeError(`${name} names ${id}, which isn't in the node tree`)
      }
    }
    for (const child of children) {
      if (listed.has(child)) {
        throw new TypeError(`${name} lists ${child} more than once`)
      }
      listed.add(child)
      const shown = baseParents
        ? baseParents.get(child)
        : flags?.parents.get(child)
      if (shown !== undefined && shown !== parent) {
        throw new TypeError(
          `${name} lists ${child} in ${parent}, but its parent is ${String(shown)}`
        )
      }
    }
    read.set(parent, children)
  }
  return read
}
