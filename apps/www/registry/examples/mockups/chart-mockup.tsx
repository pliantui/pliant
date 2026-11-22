"use client"

import {
  ScriptedFrame,
  useScriptedAsks,
} from "@/components/demo/scripted-frame"

const asks = [
  "show this as a bar chart",
  "stack by status",
  "only show overdue",
]

const months = [
  { month: "May", paid: 310, pending: 60, overdue: 40 },
  { month: "Jun", paid: 240, pending: 50, overdue: 30 },
  { month: "Jul", paid: 330, pending: 70, overdue: 45 },
  { month: "Aug", paid: 360, pending: 55, overdue: 35 },
  { month: "Sep", paid: 290, pending: 65, overdue: 50 },
  { month: "Oct", paid: 420, pending: 80, overdue: 60 },
]

type Status = "paid" | "pending" | "overdue"

const shades: Record<Status, string> = {
  paid: "color-mix(in oklch, var(--foreground) 45%, var(--background))",
  pending: "color-mix(in oklch, var(--foreground) 65%, var(--background))",
  overdue: "color-mix(in oklch, var(--foreground) 90%, var(--background))",
}

const width = 300
const height = 140
const step = width / months.length

export function ChartMockup() {
  const scripted = useScriptedAsks()
  const bars = scripted.has(asks[0] ?? "") || scripted.has(asks[1] ?? "")
  const series: Status[] = scripted.has(asks[2] ?? "")
    ? ["overdue"]
    : ["paid", "pending", "overdue"]
  const stacked = scripted.has(asks[1] ?? "") && series.length > 1
  const total = (row: (typeof months)[number]) =>
    series.reduce((sum, key) => sum + row[key], 0)
  const max = Math.max(...months.map(total))
  const y = (value: number) => height - (value / max) * height

  return (
    <ScriptedFrame label="revenue chart" asks={asks} scripted={scripted}>
      <figure className="flex flex-col gap-3">
        <figcaption className="text-sm font-medium">
          Order value by month, May–Oct 2026
          {series.length === 1 ? ", overdue only" : ""}
        </figcaption>
        <svg
          viewBox={`0 0 ${String(width)} ${String(height + 18)}`}
          className="h-auto max-h-52 w-full"
          aria-hidden="true"
        >
          {bars ? (
            months.map((row, index) => {
              let base = height
              return (
                <g key={row.month}>
                  {(stacked ? series : [series[0] ?? "paid"]).map((key) => {
                    const value = stacked ? row[key] : total(row)
                    const size = (value / max) * height
                    base -= size
                    return (
                      <rect
                        key={key}
                        x={index * step + step * 0.2}
                        y={base}
                        width={step * 0.6}
                        height={size}
                        fill={stacked ? shades[key] : shades.overdue}
                      />
                    )
                  })}
                </g>
              )
            })
          ) : (
            <polyline
              fill="none"
              stroke={shades.overdue}
              strokeWidth={2}
              points={months
                .map(
                  (row, index) =>
                    `${String(index * step + step / 2)},${String(y(total(row)))}`
                )
                .join(" ")}
            />
          )}
          {months.map((row, index) => (
            <text
              key={row.month}
              x={index * step + step / 2}
              y={height + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {row.month}
            </text>
          ))}
        </svg>
        <ul className="sr-only">
          {months.map((row) => (
            <li key={row.month}>
              {row.month}:{" "}
              {series.map((key) => `${key} ₹${String(row[key])}k`).join(", ")}
            </li>
          ))}
        </ul>
        {stacked && (
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
        )}
      </figure>
    </ScriptedFrame>
  )
}
