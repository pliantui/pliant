"use client"

import { DemoChart } from "@/components/demo/demo-chart"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatNumber } from "@/lib/demo/format"
import { orderRegions } from "@/lib/demo/schema"

import { ChartExampleCard } from "./chart-example-card"
import { useChartAsks } from "./use-chart-asks"

const chartAsk = "chart order value by month"

const reshapeAsks = {
  region: "split by region",
  weekly: "show weekly instead",
}

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const day = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

interface Point {
  start: string
  total: number
  byRegion: Record<string, number>
}

export function ServerChartDemo({
  rows,
  count,
  monthly,
  weekly,
}: {
  // The first few of the generated orders, as the table shows them.
  rows: { id: string; date: string; region: string; value: number }[]
  // How many orders there are in all.
  count: number
  monthly: Point[]
  weekly: Point[]
}) {
  const { chart, reshape, charted } = useChartAsks(chartAsk)
  const byWeek = reshape.has(reshapeAsks.weekly)
  const byRegion = reshape.has(reshapeAsks.region)
  const points = byWeek ? weekly : monthly
  const format = byWeek ? day : month

  return (
    <ChartExampleCard
      id="chart-server"
      title="Order history"
      description="Every order since January."
      label="the order history"
      asks={[chartAsk]}
      scripted={chart}
      followUps={
        charted
          ? {
              label: "the order history chart",
              asks: Object.values(reshapeAsks),
              scripted: reshape,
            }
          : undefined
      }
    >
      {charted && (
        <div className="flex flex-col gap-2">
          <DemoChart
            rows={points.map((point) => ({
              label: format.format(new Date(point.start)),
              values: { total: point.total, ...point.byRegion },
            }))}
            series={
              byRegion
                ? orderRegions.map((region) => ({ key: region, label: region }))
                : [{ key: "total", label: "Order value" }]
            }
            kind={byWeek ? "line" : "bar"}
            stacked={byRegion}
            caption="Order value over time"
            formatValue={formatCurrency}
          />
          <p className="text-xs text-muted-foreground">
            {formatNumber(count)} orders in {formatNumber(points.length)}{" "}
            {byWeek ? "weeks" : "months"}.
          </p>
        </div>
      )}
      <Table>
        <TableCaption>
          The first {formatNumber(rows.length)} of {formatNumber(count)} orders.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{row.region}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartExampleCard>
  )
}
