"use client"

import * as React from "react"
import { RotateCcwIcon } from "lucide-react"

import { ScriptedBadge } from "@/components/demo/scripted-badge"
import { NotImplementedBanner } from "@/components/not-implemented-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/lib/demo/format"
import type { MonthlyRevenue } from "@/lib/demo/schema"

type Status = "paid" | "pending" | "overdue"

const total = {
  label: "Order value",
  color: "color-mix(in oklch, var(--foreground) 70%, var(--card))",
}

const series: { status: Status; label: string; color: string }[] = [
  {
    status: "paid",
    label: "Paid",
    color: "color-mix(in oklch, var(--foreground) 70%, var(--card))",
  },
  {
    status: "pending",
    label: "Pending",
    color: "color-mix(in oklch, var(--foreground) 42%, var(--card))",
  },
  {
    status: "overdue",
    label: "Overdue",
    color: "color-mix(in oklch, var(--foreground) 20%, var(--card))",
  },
]

const month = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const width = 320
const height = 140
const gap = 2

interface ChartView {
  kind: "bar" | "line"
  stacked: boolean
}

const original: ChartView = { kind: "bar", stacked: false }

const asks: { prompt: string; apply: (view: ChartView) => ChartView }[] = [
  {
    prompt: "make this a line chart",
    apply: (view) => ({ ...view, kind: "line" }),
  },
  {
    prompt: "stack by status",
    apply: (view) => ({ ...view, stacked: true }),
  },
]

function valueOf(row: MonthlyRevenue, status: Status | "total") {
  return status === "total" ? row.paid + row.pending + row.overdue : row[status]
}

function shownSeries(view: ChartView) {
  return view.stacked ? series : [{ status: "total" as const, ...total }]
}

function Chart({ data, view }: { data: MonthlyRevenue[]; view: ChartView }) {
  const shown = shownSeries(view)
  const totals = data.map((row) =>
    view.stacked && view.kind === "bar"
      ? valueOf(row, "total")
      : Math.max(...shown.map(({ status }) => valueOf(row, status)))
  )
  const max = Math.max(...totals, 1)
  const step = width / data.length
  const barWidth = step * 0.6
  const y = (value: number) => height - (value / max) * height

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height + 20)}`}
      className="h-auto max-h-56 w-full overflow-visible"
      aria-hidden="true"
    >
      {[0.25, 0.5, 0.75].map((line) => (
        <line
          key={line}
          x1={0}
          x2={width}
          y1={height * line}
          y2={height * line}
          className="stroke-border"
          strokeDasharray="2 4"
        />
      ))}
      {view.kind === "bar"
        ? data.map((row, index) => {
            const x = index * step + (step - barWidth) / 2
            let base = height
            return (
              <g key={row.month}>
                <title>{`${month.format(new Date(row.month))}: ${shown
                  .map(
                    ({ status, label }) =>
                      `${label} ${formatCurrency(valueOf(row, status))}`
                  )
                  .join(", ")}`}</title>
                {shown.map(({ status, color }, layer) => {
                  const size = (valueOf(row, status) / max) * height
                  const top = base - size
                  const rect = (
                    <rect
                      key={status}
                      x={x}
                      y={top + (layer > 0 ? gap : 0)}
                      width={barWidth}
                      height={Math.max(0, size - (layer > 0 ? gap : 0))}
                      rx={layer === shown.length - 1 ? 4 : 0}
                      fill={color}
                    />
                  )
                  base = top
                  return rect
                })}
              </g>
            )
          })
        : shown.map(({ status, color }) => (
            <polyline
              key={status}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={data
                .map(
                  (row, index) =>
                    `${String(index * step + step / 2)},${String(y(valueOf(row, status)))}`
                )
                .join(" ")}
            />
          ))}
      {data.map((row, index) => (
        <text
          key={row.month}
          x={index * step + step / 2}
          y={height + 15}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {month.format(new Date(row.month))}
        </text>
      ))}
    </svg>
  )
}

export function RevenueChartCard({ data }: { data: MonthlyRevenue[] }) {
  const [view, setView] = React.useState(original)
  const customized =
    view.kind !== original.kind || view.stacked !== original.stacked
  const shown = shownSeries(view)

  return (
    <Card
      role="region"
      aria-labelledby="revenue-title"
      className="min-w-0 gap-4"
    >
      <CardHeader>
        <CardTitle id="revenue-title">Revenue</CardTitle>
        <CardDescription>Order value by month, Jan–Oct 2026.</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            {customized && <Badge variant="secondary">Customized</Badge>}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // Stays focusable after a reset, so focus doesn't fall back to
              // the page.
              aria-disabled={!customized}
              aria-label="Reset revenue"
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
              onClick={() => {
                if (customized) setView(original)
              }}
            >
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Chart data={data} view={view} />
        {shown.length > 1 && (
          <ul className="flex gap-4 text-xs text-muted-foreground">
            {shown.map(({ status, label, color }) => (
              <li key={status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-[2px]"
                  style={{ background: color }}
                />
                {label}
              </li>
            ))}
          </ul>
        )}
        <table className="sr-only">
          <caption>Order value by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {shown.map(({ status, label }) => (
                <th key={status} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.month}>
                <th scope="row">{month.format(new Date(row.month))}</th>
                {shown.map(({ status }) => (
                  <td key={status}>{formatCurrency(valueOf(row, status))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t pt-4 [.border-t]:pt-4">
        <div
          role="group"
          aria-label="Ask about revenue"
          className="flex flex-wrap gap-1.5"
          // Found by the unfinished work check: these answers are scripted.
          data-unfinished="scripted"
        >
          {asks.map(({ prompt, apply }) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs font-normal"
              onClick={() => {
                setView(apply)
              }}
            >
              {prompt}
              <ScriptedBadge />
            </Button>
          ))}
        </div>
        <NotImplementedBanner variant="preview">
          Charts that reshape when you ask aren&apos;t in Pliant yet, so this
          card plays scripted changes.
        </NotImplementedBanner>
      </CardFooter>
    </Card>
  )
}
