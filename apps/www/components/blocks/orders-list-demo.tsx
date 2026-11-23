"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { ordersTableAsks } from "@/lib/demo/asks"
import type { Order } from "@/lib/demo/schema"
import { OrdersList } from "@/registry/blocks/orders-list/orders-list"

export function OrdersListDemo({ data }: { data: Order[] }) {
  return (
    <DemoFrame
      target="orders-table"
      label="the orders list"
      asks={ordersTableAsks}
      className="max-w-none"
    >
      <OrdersList data={data} />
    </DemoFrame>
  )
}
