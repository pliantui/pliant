import { PliantRoot } from "@pliantui/react"
import { localAdapter } from "@pliantui/react/local"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function ReportsPage() {
  return (
    <PliantRoot surface="/reports" storage={localAdapter}>
      <PliantRegion
        id="charts"
        slots={{ revenue: <p>Revenue</p>, refunds: <p>Refunds</p> }}
      />
    </PliantRoot>
  )
}
