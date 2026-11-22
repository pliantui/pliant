// #region page
import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

import { StatCard } from "./stat-card"

const surface = "/orders/[id]"

export default function OrderPage() {
  return (
    <PliantRoot surface={surface} storage={localAdapter}>
      <PliantPrePaint surface={surface} />
      <PliantRegion
        id="order-summary"
        slots={{
          value: <StatCard label="Value" value="₹1,86,500" />,
          payment: <StatCard label="Payment" value="Overdue" />,
          region: <StatCard label="Region" value="West" />,
        }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      />
    </PliantRoot>
  )
}
// #endregion page
