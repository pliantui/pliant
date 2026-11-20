/**
 * The identity of the node or item an address points at. A node's identity is
 * its bare id, so `<parent>/slots/<id>` and `<id>` are the same node wherever
 * it sits. An item in another collection keeps its item address, rebased on
 * its node's identity: `page/slots/orders-table/columns/notes` is
 * `orders-table/columns/notes`. Reserved targets such as `@surface` are their
 * own identity.
 */
export function identityOf(address: string): string {
  const segments = address.split("/")
  for (let index = segments.length - 2; index > 0; index -= 2) {
    if (segments[index] === "slots") {
      return segments.slice(index + 1).join("/")
    }
  }
  return address
}

// The address with its last collection and item removed.
const lastSegment = /\/[^/]+\/[^/]+$/

/** The identity of the node that holds the item an address points at. */
export function parentOf(address: string): string {
  return identityOf(address.replace(lastSegment, ""))
}

/**
 * Each node or item on the way to an address, by identity, with the identity
 * of the node that holds it as the address shows: `page/slots/form/fields/a`
 * gives `["form/fields/a", "form"]` and `["form", "page"]`.
 */
export function addressParents(address: string): [string, string][] {
  const pairs: [string, string][] = []
  for (
    let rest = address, parent = rest.replace(lastSegment, "");
    parent !== rest;
    rest = parent, parent = rest.replace(lastSegment, "")
  ) {
    pairs.push([identityOf(rest), identityOf(parent)])
  }
  return pairs
}
