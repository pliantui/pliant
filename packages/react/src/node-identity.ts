/** A node's identity: its bare id, the part after its last `/slots/`. */
export function identityOf(target: string): string {
  return target.split("/slots/").at(-1) ?? target
}

// The address with its last collection and item removed.
const lastSegment = /\/[^/]+\/[^/]+$/

/**
 * The identity of the node that holds the item an address points at, as the
 * address shows it, or `undefined` for a bare id.
 */
export function parentOf(target: string): string | undefined {
  const parent = target.replace(lastSegment, "")
  return parent === target ? undefined : identityOf(parent)
}
