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
      slots={{ items: <ul>{renderItem(items[0] ?? "")}</ul> }}
    />
  )
}
