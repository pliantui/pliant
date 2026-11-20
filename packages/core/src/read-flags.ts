import { addressSchema, flagsSchema, type Flags } from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import { addressParents, identityOf } from "./node-identity"

/** Flags by identity, and each node's parent as the flags' addresses show. */
export interface ReadFlags {
  readonly flags: ReadonlyMap<string, Flags>
  readonly parents: ReadonlyMap<string, string>
}

/**
 * Checks `flags` and reads them by identity. Addresses of the same node
 * combine their flags. Returns undefined when no node is flagged, so
 * resolution can skip the guardrails. `name` names the option in errors.
 *
 * Throws a `TypeError` unless `flags` is a plain object whose keys are
 * addresses and whose values are flags, and when two addresses put the same
 * node in different parents.
 */
export function readFlags(
  flags: unknown,
  name = "flags"
): ReadFlags | undefined {
  if (flags === undefined) {
    return undefined
  }
  if (!isPlainObject(flags)) {
    throw new TypeError(`${name} must be a plain object of flags by address`)
  }
  const read = new Map<string, Flags>()
  const parents = new Map<string, string>()
  for (const [address, value] of Object.entries(flags)) {
    const parsed = flagsSchema.safeParse(value)
    if (!addressSchema.safeParse(address).success || !parsed.success) {
      throw new TypeError(`${name}["${address}"] must be flags at an address`)
    }
    const id = identityOf(address)
    const merged: Flags = { ...read.get(id) }
    for (const flag of flagsSchema.keyof().options) {
      if (parsed.data[flag] === true) {
        merged[flag] = true
      }
    }
    read.set(id, merged)
    for (const [node, parent] of addressParents(address)) {
      const known = parents.get(node)
      if (known !== undefined && known !== parent) {
        throw new TypeError(
          `${name} put ${node} in both ${known} and ${parent}`
        )
      }
      parents.set(node, parent)
    }
  }
  return read.size > 0 ? { flags: read, parents } : undefined
}
