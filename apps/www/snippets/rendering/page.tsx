// #region page
import { PliantRegion } from "@/components/pliant/pliant-region"

import { loadLayers } from "./load-layers"
import { OrdersRoot } from "./orders-root"

export default async function OrdersPage() {
  const layers = await loadLayers("/orders")

  return (
    <OrdersRoot layers={layers}>
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <p>Revenue: ₹4,821,000</p>,
          overdue: <p>Overdue: 17</p>,
        }}
      />
    </OrdersRoot>
  )
}
// #endregion page
