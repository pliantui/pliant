// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function OrdersPage() {
  return (
    <PliantRoot surface="/orders" storage={localAdapter}>
      <PliantRegion
        id="key-metrics"
        slots={{
          revenue: <p>Revenue: ₹4,821,000</p>,
          orders: <p>Orders: 200</p>,
          overdue: <p>Overdue: 17</p>,
        }}
        className="grid grid-cols-3 gap-4"
      />
    </PliantRoot>
  )
}
// #endregion page
