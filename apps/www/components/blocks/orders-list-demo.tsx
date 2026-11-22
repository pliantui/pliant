"use client"

import { OrdersCardTable } from "@/app/(home)/components/orders-card"
import { DemoFrame } from "@/components/demo/demo-frame"
import type { Order } from "@/lib/demo/schema"

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
      <OrdersCardTable data={data} />
    </DemoFrame>
  )
}
