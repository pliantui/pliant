import { nodeIdSchema } from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"

const isNodeId = (id: unknown) => nodeIdSchema.safeParse(id).success

/**
 * Checks `baseParents` and reads it as a map of node id to parent id,
 * leaving out nodes at the top of the surface. `name` names the option in
 * errors. Throws a `TypeError` unless it is a plain object that maps node
 * ids to node ids or `null`.
 */
export function readBaseParents(
  baseParents: unknown,
  name = "baseParents"
): Map<string, string> | undefined {
  if (baseParents === undefined) {
    return undefined
  }
  if (!isPlainObject(baseParents)) {
    throw new TypeError(`${name} must be a plain object of parents by node id`)
  }
  const read = new Map<string, string>()
  for (const [id, parent] of Object.entries(baseParents)) {
    if (!isNodeId(id) || (parent !== null && !isNodeId(parent))) {
      throw new TypeError(`${name}["${id}"] must be a node id or null`)
    }
    if (typeof parent === "string") {
      read.set(id, parent)
    }
  }
  return read
}
