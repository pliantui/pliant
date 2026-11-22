"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import type { Order } from "@/lib/demo/schema"
import { OrdersList } from "@/registry/blocks/orders-list/orders-list"

export function OrdersListDemo({ data }: { data: Order[] }) {
  return (
    <DemoFrame
      target="orders-table"
      label="the orders list"
      asks={[
        "sort by value, highest first",
        "only show overdue orders",
        "hide the notes column",
        "put customer before order",
      ]}
      className="max-w-none"
    >
      <OrdersList data={data} />
    </DemoFrame>
  )
}
