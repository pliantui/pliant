import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { DemoFrame } from "@/components/demo/demo-frame"
import { orders } from "@/lib/demo/data"
import { OrdersTableDemo } from "@/registry/examples/orders-table-demo"

export function DataTableDemo() {
  return (
    <PliantRoot surface="/docs/components/data-table" storage={localAdapter}>
      <DemoFrame
        target="orders-table"
        label="orders table"
        asks={[
          "sort by value, highest first",
          "only show overdue orders",
          "hide the notes column",
          "put customer before order",
        ]}
      >
        <OrdersTableDemo data={orders.slice(0, 48)} />
      </DemoFrame>
    </PliantRoot>
  )
}
