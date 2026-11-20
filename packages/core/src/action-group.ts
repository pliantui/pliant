/**
 * The action group an action belongs to in the base: for an item, its node
 * and collection, such as `orders-toolbar/actions`; for a node, the node
 * that holds it in `parents`. A node's slots and each of its item
 * collections are separate groups.
 */
export function groupOf(
  id: string,
  parents: ReadonlyMap<string, string | null>
): string | null | undefined {
  return id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : parents.get(id)
}
