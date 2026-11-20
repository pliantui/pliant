import { PliantRoot } from "@pliantui/react"

import { FramedPanel } from "@/components/framed-panel"
import { ItemList } from "@/components/item-list"
import { KpiCard } from "@/components/kpi-card"
import { PliantRegion } from "@/components/pliant/pliant-region"
import { Section } from "@/components/section"

import { OrderDetails } from "./order-details"
import { OrdersTable } from "./orders-table"

const surface = "/orders"

export default function OrdersPage() {
  const metrics = {
    revenue: <KpiCard label="Revenue" value="$10" />,
    refunds: <KpiCard label="Refunds" value="$2" />,
  }

  return (
    <PliantRoot surface={surface}>
      <h1>Orders</h1>
      <PliantRegion
        id="page"
        slots={{
          summary: <PliantRegion id="summary" slots={metrics} />,
          details: <OrderDetails />,
        }}
      />
      <FramedPanel slots={{ first: <p>First</p>, second: <p>Second</p> }} />
      <ItemList
        items={["late"]}
        renderItem={() => (
          <PliantRegion id="alerts" slots={{ late: <p>Late orders</p> }} />
        )}
      />
      <Section title="All orders">
        <OrdersTable />
      </Section>
    </PliantRoot>
  )
}
