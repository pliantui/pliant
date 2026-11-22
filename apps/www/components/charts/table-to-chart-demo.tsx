"use client"

import { DemoChart } from "@/components/demo/demo-chart"
import { useScriptedAsks } from "@/components/demo/scripted-frame"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatNumber } from "@/lib/demo/format"

import { ChartExampleCard } from "./chart-example-card"

const chartAsk = "chart revenue by region above this table"

export interface RegionTotals {
  region: string
  orders: number
  revenue: number
}

export function TableToChartDemo({ regions }: { regions: RegionTotals[] }) {
  const scripted = useScriptedAsks()

  return (
    <ChartExampleCard
      id="chart-from-table"
      title="Revenue by region"
      description="Paid orders, Jan–Oct 2026."
      label="the regions table"
      asks={[chartAsk]}
      scripted={scripted}
    >
      {scripted.has(chartAsk) && (
        <DemoChart
          rows={regions.map((row) => ({
            label: row.region,
            values: { revenue: row.revenue },
          }))}
          series={[{ key: "revenue", label: "Revenue" }]}
          kind="bar"
          caption="Revenue by region"
          formatValue={formatCurrency}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.map((row) => (
            <TableRow key={row.region}>
              <TableCell className="font-medium">{row.region}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.orders)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.revenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartExampleCard>
  )
}
