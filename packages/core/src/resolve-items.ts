import { orderItems } from "./order-items"
import type { ResolvedLayers } from "./resolve-layers"
import type { RegionEntry } from "./resolve-region"

type ItemEntry = Extract<RegionEntry, { kind: "slot" }>

/**
 * The items of one of a node's collections (`fields`, `items`) in render
 * order, each with its visibility, pin and collapse. Items never leave
 * their node, so the order is the base order with each item's position
 * applied as `orderItems` does, hidden items included. Ops on ids that
 * aren't in `items` are ignored.
 */
export function resolveItems(
  { properties, placements }: Pick<ResolvedLayers, "properties" | "placements">,
  id: string,
  collection: string,
  items: readonly string[]
): ItemEntry[] {
  const node = properties.get(id)
  const order = orderItems(items, (item) => {
    const placement = placements.get(`${id}/${collection}/${item}`)
    return placement?.container === id ? placement.position : undefined
  })
  return order.map((item) => {
    const address = `${id}/${collection}/${item}`
    const position = placements.get(address)?.position
    const pin =
      position && "pin" in position && position.pin !== "none"
        ? position.pin
        : undefined
    const collapse = node?.get(`collapse.${item}`)?.winner.check.op
    return {
      kind: "slot" as const,
      id: item,
      visible:
        properties.get(address)?.get("visible")?.winner.check.op.op !== "hide",
      ...(pin && { pinned: pin }),
      ...(collapse?.op === "collapse" &&
        collapse.into !== "none" && {
          collapsed: {
            into: collapse.into,
            ...(collapse.label !== undefined && { label: collapse.label }),
          },
        }),
    }
  })
}
