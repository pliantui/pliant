import { nodeIdSchema } from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import type { ReadFlags } from "./read-flags"

const isNodeId = (id: unknown) => nodeIdSchema.safeParse(id).success

/**
 * Checks `baseParents` against itself and `flags`, and reads it as a map of
 * node id to parent id, `null` for a node at the top of the surface. `name`
 * names the option in errors.
 *
 * Throws a `TypeError` unless it is a plain object that maps node ids to
 * node ids or `null` without a cycle, lists every node in the flags'
 * addresses, and puts each in the parent its address shows.
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
  for (const id of read.keys()) {
    const seen = new Set<string>()
    for (let node = read.get(id); node; node = read.get(node)) {
      if (seen.has(node)) {
        throw new TypeError(`${name} puts ${id} inside a cycle`)
      }
      seen.add(node)
    }
  }
  const nodes = [...(flags?.flags.keys() ?? [])].filter(
    (id) => !id.includes("/")
  )
  for (const [id, parent] of flags?.parents ?? []) {
    nodes.push(parent)
    if (!id.includes("/") && read.get(id) !== parent) {
      throw new TypeError(`${name} must put ${id} in ${parent}, as flags do`)
    }
  }
  const missing = nodes.find((id) => !read.has(id))
  if (missing !== undefined) {
    throw new TypeError(`${name} must list ${missing}, which flags name`)
  }
  return read
}
