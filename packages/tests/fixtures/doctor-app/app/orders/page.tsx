import { PliantRoot } from "@pliantui/react"
import { PliantPrePaint } from "@pliantui/react/pre-paint"

import { PliantRegion } from "@/components/pliant/pliant-region"

const surface = "/orders"

export default function OrdersPage() {
  return (
    <PliantRoot surface={surface}>
      <PliantPrePaint surface={surface} />
      <PliantRegion
        id="summary"
        slots={{ total: <p>Total</p>, status: <p>Status</p> }}
      />
    </PliantRoot>
  )
}
