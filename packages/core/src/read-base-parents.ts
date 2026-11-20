import { nodeIdSchema } from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import { checkPrimaries, type ReadFlags } from "./read-flags"

const isNodeId = (id: unknown) => nodeIdSchema.safeParse(id).success

/**
 * Checks `baseParents` against itself and `flags`, and reads it as a map of
 * node id to parent id, `null` for a node at the top of the surface, in its
 * key order. A node it leaves out takes the parent a flag's address shows,
 * which the caller adds. `name` names the option in errors.
 *
 * Throws a `TypeError` unless it is a plain object that maps node ids to
 * node ids or `null`, puts each node a flag's address names in the parent
 * that address shows, and, with those parents, has no cycle and at most one
 * primary action in a node.
 */
export function readBaseParents(
  baseParents: unknown,
  flags: ReadFlags | undefined,
  name = "baseParents"
): Map<string, string | null> | undefined {
  if (baseParents === undefined) {
    return undefined
  }
  if (!isPlainObject(baseParents)) {
    throw new TypeError(`${name} must be a plain object of parents by node id`)
  }
  const read = new Map<string, string | null>()
  for (const [id, parent] of Object.entries(baseParents)) {
    if (!isNodeId(id) || (parent !== null && !isNodeId(parent))) {
      throw new TypeError(`${name}["${id}"] must be a node id or null`)
    }
    read.set(id, typeof parent === "string" ? parent : null)
  }
  // A node the tree leaves out, such as one not mounted yet, takes the
  // parent its flag's address shows.
  const all = new Map<string, string | null>(flags?.parents)
  for (const [id, parent] of read) {
    const shown = flags?.parents.get(id)
    if (shown !== undefined && shown !== parent) {
      throw new TypeError(`${name} must put ${id} in ${shown}, as flags do`)
    }
    all.set(id, parent)
  }
  for (const id of read.keys()) {
    const seen = new Set<string>()
    for (let node = all.get(id); node; node = all.get(node)) {
      if (seen.has(node)) {
        throw new TypeError(`${name} puts ${id} inside a cycle`)
      }
      seen.add(node)
    }
  }
  checkPrimaries(flags?.flags, all, name)
  return read
}
