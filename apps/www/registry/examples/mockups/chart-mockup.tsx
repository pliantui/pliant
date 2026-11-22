"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"
import { mockupAsks } from "@/lib/components/mockup-asks"
import type { MonthlyRevenue } from "@/lib/demo/schema"

const asks = mockupAsks.chart

type Status = "paid" | "pending" | "overdue"

const statuses: Status[] = ["paid", "pending", "overdue"]

const shades: Record<Status, string> = {
  paid: "color-mix(in oklch, var(--foreground) 45%, var(--background))",
  pending: "color-mix(in oklch, var(--foreground) 65%, var(--background))",
  overdue: "color-mix(in oklch, var(--foreground) 90%, var(--background))",
}

const monthName = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  timeZone: "UTC",
})

const width = 300
const height = 140

// The company's order value by month and status, from the shared demo data.
export function ChartMockup({ data }: { data: MonthlyRevenue[] }) {
  const scripted = useScriptedAsks()
  // Jul–Sep 2026 is the last full quarter in the data.
  const months = scripted.has(asks.thisQuarter)
    ? data.filter(({ month }) => month >= "2026-07" && month < "2026-10")
    : data
  const series = scripted.has(asks.overdueOnly)
    ? ["overdue" as const]
    : statuses
  const stacked = scripted.has(asks.stack) || scripted.has(asks.percent)
  const percent = scripted.has(asks.percent)
  const bars = stacked || scripted.has(asks.bars)
  const total = (row: MonthlyRevenue) =>
    series.reduce((sum, key) => sum + row[key], 0)
  const max = percent ? 1 : Math.max(...months.map(total), 1)
  const step = width / months.length
  const share = (row: MonthlyRevenue, key: Status) =>
    percent ? row[key] / Math.max(total(row), 1) : row[key]
  const y = (value: number) => height - (value / max) * height

  return (
    <ScriptedFrame
      label="revenue chart"
      asks={Object.values(asks)}
      scripted={scripted}
    >
      <figure className="flex flex-col gap-3">
        <figcaption className="text-sm font-medium">
          Revenue by month{percent ? ", as a share of each month" : ""}
        </figcaption>
        <svg
          viewBox={`0 0 ${String(width)} ${String(height + 18)}`}
          className="h-auto max-h-52 w-full"
          aria-hidden="true"
        >
          {bars
            ? months.map((row, index) => {
                const x = index * step + step * 0.2
                if (!stacked) {
                  const value = total(row)
                  return (
                    <rect
                      key={row.month}
                      x={x}
                      y={y(value)}
                      width={step * 0.6}
                      height={height - y(value)}
                      fill={shades.overdue}
                    />
                  )
                }
                let base = height
                return (
                  <g key={row.month}>
                    {series.map((key) => {
                      const size = (share(row, key) / max) * height
                      base -= size
                      return (
                        <rect
                          key={key}
                          x={x}
                          y={base}
                          width={step * 0.6}
                          height={size}
                          fill={shades[key]}
                          stroke="var(--background)"
                          strokeWidth={1}
                        />
                      )
                    })}
                  </g>
                )
              })
            : series.map((key) => (
                <polyline
                  key={key}
                  fill="none"
                  stroke={shades[key]}
                  strokeWidth={2}
                  points={months
                    .map(
                      (row, index) =>
                        `${String(index * step + step / 2)},${String(y(row[key]))}`
                    )
                    .join(" ")}
                />
              ))}
          {months.map((row, index) => (
            <text
              key={row.month}
              x={index * step + step / 2}
              y={height + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {monthName.format(new Date(row.month))}
            </text>
          ))}
        </svg>
        <ul className="flex gap-4 text-xs text-muted-foreground">
          {series.map((key) => (
            <li key={key} className="flex items-center gap-1.5 capitalize">
              <span
                aria-hidden="true"
                className="size-2 rounded-[2px]"
                style={{ background: shades[key] }}
              />
              {key}
            </li>
          ))}
        </ul>
        <table className="sr-only">
          <caption>Revenue by month and status</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {series.map((key) => (
                <th key={key} scope="col">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <th scope="row">{monthName.format(new Date(row.month))}</th>
                {series.map((key) => (
                  <td key={key}>₹{row[key].toLocaleString("en-IN")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </ScriptedFrame>
  )
}
