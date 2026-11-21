import {
  addressSchema,
  manifestSchema,
  type Manifest,
} from "@pliantui/contract"

import { isPlainObject } from "./is-plain-object"
import { identityOf } from "./node-identity"

/**
 * Checks `manifests` and reads them by identity. `name` names the option in
 * errors.
 *
 * Throws a `TypeError` unless `manifests` is a plain object whose keys are
 * addresses and whose values are valid manifests, and when two addresses
 * name the same node or item.
 */
export function readManifests(
  manifests: unknown,
  name = "manifests"
): ReadonlyMap<string, Manifest> {
  const read = new Map<string, Manifest>()
  if (manifests === undefined) {
    return read
  }
  if (!isPlainObject(manifests)) {
    throw new TypeError(
      `${name} must be a plain object of manifests by address`
    )
  }
  for (const [address, value] of Object.entries(manifests)) {
    const parsed = manifestSchema.safeParse(value)
    if (!addressSchema.safeParse(address).success || !parsed.success) {
      throw new TypeError(
        `${name}["${address}"] must be a manifest at an address`
      )
    }
    const id = identityOf(address)
    if (read.has(id)) {
      throw new TypeError(`${name} gives ${id} two manifests`)
    }
    read.set(id, parsed.data)
  }
  return read
}
