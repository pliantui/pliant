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

/** The identity of the node that holds the item an address points at. */
export function parentOf(address: string): string {
  return identityOf(address.replace(/\/[^/]+\/[^/]+$/, ""))
}
