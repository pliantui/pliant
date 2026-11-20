import * as React from "react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export function ItemList({
  items,
  renderItem,
}: {
  items: string[]
  renderItem: (item: string) => React.ReactNode
}) {
  return (
    <PliantRegion
      id="item-list"
      slots={{ items: <ul>{items.map((item) => renderItem(item))}</ul> }}
    />
  )
}
