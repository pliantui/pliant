"use client"

import * as React from "react"

import { usePliantNodeProps } from "@pliantui/react"

import { DemoChart } from "@/components/demo/demo-chart"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { UnfinishedDot } from "@/components/unfinished-dot"
import { visitors } from "@/lib/acme/data"

import { LocalAsks } from "./local-asks"

const ranges = [
  { value: "90d", label: "Last 3 months", days: 91 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "7d", label: "Last 7 days", days: 7 },
] as const

type Range = (typeof ranges)[number]["value"]

const series = [
  { key: "mobile", label: "Mobile" },
  { key: "desktop", label: "Desktop" },
]

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
})
const count = new Intl.NumberFormat("en-US")

const lineAsk = "chart visitors by device as a line"
const shareAsk = "show mobile's share of visitors over time"

function isRange(value: string): value is Range {
  return ranges.some((range) => range.value === value)
}

export function VisitorsChart() {
  const node = usePliantNodeProps("acme-visitors")
  const [range, setRange] = React.useState<Range>("90d")
  const [applied, setApplied] = React.useState<string | null>(null)
  const { days, label } =
    ranges.find((entry) => entry.value === range) ?? ranges[0]
  const rows = visitors.slice(-days).map((row) => ({
    label: day.format(new Date(row.date)),
    values: { desktop: row.desktop, mobile: row.mobile },
  }))
  const total = visitors
    .slice(-days)
    .reduce((sum, row) => sum + row.desktop + row.mobile, 0)
  const changeRange = (value: string) => {
    if (isRange(value)) setRange(value)
  }

  return (
    <Card {...node} className="@container/card">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Total Visitors
          {applied && <UnfinishedDot />}
        </CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {count.format(total)} visitors in the {label.toLowerCase()}
          </span>
          <span className="@[540px]/card:hidden">{label}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={changeRange}
            variant="outline"
            aria-label="Time range"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {ranges.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value}>
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={changeRange}>
            <SelectTrigger
              className="flex w-40 @[767px]/card:hidden"
              size="sm"
              aria-label="Time range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {ranges.map((entry) => (
                <SelectItem
                  key={entry.value}
                  value={entry.value}
                  className="rounded-lg"
                >
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <DemoChart
          rows={rows}
          series={series}
          kind={applied === lineAsk ? "line" : "area"}
          stacked={applied !== lineAsk}
          percent={applied === shareAsk}
          width={960}
          height={220}
          caption={`Visitors by device, ${label.toLowerCase()}`}
          formatValue={(value) => count.format(value)}
          className="[&_svg]:max-h-[250px]"
        />
      </CardContent>
      <CardFooter className="border-t pt-4 [.border-t]:pt-4">
        <LocalAsks
          target="acme-visitors"
          label="the visitors chart"
          prompts={[lineAsk, shareAsk]}
          onShow={setApplied}
        />
      </CardFooter>
    </Card>
  )
}
