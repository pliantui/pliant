"use client"

import { DemoChart } from "@/components/demo/demo-chart"
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
import { useChartAsks } from "./use-chart-asks"

const chartAsk = "chart revenue by region above this table"

const reshapeAsks = {
  line: "make this a line chart",
  stack: "stack by status",
  monthly: "show monthly instead",
}

const statusSeries = [
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "overdue", label: "Overdue" },
]

// Order value by status, for one region or one month.
export interface StatusTotals {
  label: string
  orders: number
  paid: number
  pending: number
  overdue: number
}

export function TableToChartDemo({
  regions,
  months,
}: {
  regions: StatusTotals[]
  months: StatusTotals[]
}) {
  const { chart, reshape, charted } = useChartAsks(chartAsk)
  const stacked = reshape.has(reshapeAsks.stack)
  const rows = reshape.has(reshapeAsks.monthly) ? months : regions

  return (
    <ChartExampleCard
      id="chart-from-table"
      title="Revenue by region"
      description="Paid orders, Jan–Oct 2026."
      label="the regions table"
      asks={[chartAsk]}
      scripted={chart}
      followUps={
        charted
          ? {
              label: "the chart",
              asks: Object.values(reshapeAsks),
              scripted: reshape,
            }
          : undefined
      }
    >
      {charted && (
        <DemoChart
          rows={rows.map((row) => ({
            label: row.label,
            values: {
              paid: row.paid,
              pending: row.pending,
              overdue: row.overdue,
            },
          }))}
          series={stacked ? statusSeries : [{ key: "paid", label: "Revenue" }]}
          kind={reshape.has(reshapeAsks.line) ? "line" : "bar"}
          stacked={stacked}
          caption={
            reshape.has(reshapeAsks.monthly)
              ? "Revenue by month"
              : "Revenue by region"
          }
          formatValue={formatCurrency}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Paid orders</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {regions.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.orders)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.paid)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartExampleCard>
  )
}
