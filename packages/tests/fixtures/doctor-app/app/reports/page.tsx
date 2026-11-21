import { PliantRoot } from "@pliantui/react"

import { PliantRegion } from "@/components/pliant/pliant-region"

export default function ReportsPage() {
  return (
    <PliantRoot surface="/reports">
      <PliantRegion
        id="charts"
        slots={{ revenue: <p>Revenue</p>, refunds: <p>Refunds</p> }}
      />
    </PliantRoot>
  )
}
