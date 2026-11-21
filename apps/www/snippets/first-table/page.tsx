// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { orders } from "./data"
import { OrdersTable } from "./orders-table"

export default function OrdersPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <PliantRoot surface="/orders" storage={localAdapter}>
        <PliantPrePaint surface="/orders" />
        <h1 className="mb-4 text-2xl font-semibold">Orders</h1>
        <OrdersTable data={orders} />
      </PliantRoot>
    </main>
  )
}
// #endregion page
