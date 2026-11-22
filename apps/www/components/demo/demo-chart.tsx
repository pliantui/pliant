import { cn } from "cn"

export interface DemoChartSeries {
  key: string
  label: string
}

export interface DemoChartRow {
  // The row's label on the x axis, like "Jan".
  label: string
  values: Record<string, number>
}

// Shades of the foreground, so the chart reads in both themes without a
// palette of its own.
const shades = [90, 65, 45, 28].map(
  (share) =>
    `color-mix(in oklch, var(--foreground) ${String(share)}%, var(--background))`
)

function shadeOf(index: number) {
  return shades[index % shades.length] ?? "var(--foreground)"
}

const width = 320
const height = 140

// A small bar or line chart for the demos, with a table for screen readers.
export function DemoChart({
  rows,
  series,
  kind,
  stacked = false,
  caption,
  formatValue,
  className,
}: {
  rows: readonly DemoChartRow[]
  series: readonly DemoChartSeries[]
  kind: "bar" | "line"
  stacked?: boolean
  // Names the chart for screen readers.
  caption: string
  formatValue: (value: number) => string
  className?: string
}) {
  const value = (row: DemoChartRow, key: string) => row.values[key] ?? 0
  const stackedBars = stacked && kind === "bar"
  const max = Math.max(
    1,
    ...rows.map((row) =>
      stackedBars
        ? series.reduce((sum, { key }) => sum + value(row, key), 0)
        : Math.max(...series.map(({ key }) => value(row, key)))
    )
  )
  const step = width / Math.max(rows.length, 1)
  const groupWidth = step * 0.6
  const y = (amount: number) => height - (amount / max) * height
  // Every label when they fit, otherwise every few.
  const labelEvery = Math.ceil(rows.length / 12)

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
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
        {kind === "bar"
          ? rows.map((row, index) => {
              const left = index * step + (step - groupWidth) / 2
              if (stackedBars) {
                let base = height
                return (
                  <g key={row.label}>
                    {series.map(({ key }, layer) => {
                      const size = (value(row, key) / max) * height
                      base -= size
                      return (
                        <rect
                          key={key}
                          x={left}
                          y={base}
                          width={groupWidth}
                          height={size}
                          fill={shadeOf(layer)}
                          stroke="var(--background)"
                          strokeWidth={1}
                        />
                      )
                    })}
                  </g>
                )
              }
              const barWidth = groupWidth / series.length
              return (
                <g key={row.label}>
                  {series.map(({ key }, layer) => (
                    <rect
                      key={key}
                      x={left + layer * barWidth}
                      y={y(value(row, key))}
                      width={barWidth}
                      height={height - y(value(row, key))}
                      rx={Math.min(3, barWidth / 4)}
                      fill={shadeOf(layer)}
                    />
                  ))}
                </g>
              )
            })
          : series.map(({ key }, layer) => (
              <polyline
                key={key}
                fill="none"
                stroke={shadeOf(layer)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={rows
                  .map(
                    (row, index) =>
                      `${String(index * step + step / 2)},${String(y(value(row, key)))}`
                  )
                  .join(" ")}
              />
            ))}
        {rows.map((row, index) =>
          index % labelEvery === 0 ? (
            <text
              key={row.label}
              x={index * step + step / 2}
              y={height + 15}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {row.label}
            </text>
          ) : null
        )}
      </svg>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map(({ key, label }, layer) => (
            <li key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-[2px]"
                style={{ background: shadeOf(layer) }}
              />
              {label}
            </li>
          ))}
        </ul>
      )}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map(({ key, label }) => (
              <th key={key} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {series.map(({ key }) => (
                <td key={key}>{formatValue(value(row, key))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
