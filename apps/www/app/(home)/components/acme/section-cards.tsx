"use client"

import * as React from "react"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UnfinishedDot } from "@/components/unfinished-dot"
import {
  formatUsd,
  getMetrics,
  getRevenuePerNewCustomer,
  type Metric,
} from "@/lib/acme/metrics"
import { PliantRegion } from "@/registry/pliant/pliant-region"

import { LocalAsks } from "./local-asks"
import { SurfaceAsks } from "./surface-asks"

const metrics = getMetrics()

function metric(id: Metric["id"]) {
  const found = metrics.find((entry) => entry.id === id)
  if (!found) throw new Error(`No metric ${id}`)
  return found
}

const perCustomer = getRevenuePerNewCustomer()

const signed = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

function MetricCard({ metric }: { metric: Metric }) {
  const Trend = metric.change >= 0 ? TrendingUpIcon : TrendingDownIcon
  return (
    <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{metric.label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {metric.value}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <Trend aria-hidden="true" />
            <span className="sr-only">
              {metric.change >= 0 ? "Up" : "Down"}
            </span>
            {metric.changeLabel}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {metric.trend} <Trend aria-hidden="true" className="size-4" />
        </div>
        <div className="text-muted-foreground">{metric.caption}</div>
      </CardFooter>
    </Card>
  )
}

const revenuePerCustomerAsk = "add a card for revenue per new customer"

// The card the revenue per new customer ask adds. A stat card isn't in
// Pliant yet, so the showcase draws it.
function RevenuePerCustomerCard() {
  const Trend = perCustomer.change >= 0 ? TrendingUpIcon : TrendingDownIcon
  return (
    <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          Revenue per New Customer
          <UnfinishedDot />
        </CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {formatUsd(perCustomer.value)}
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <Trend aria-hidden="true" />
            {signed.format(perCustomer.change)}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {perCustomer.change >= 0 ? "Up" : "Down"} on{" "}
          {perCustomer.previousMonth}
          <Trend aria-hidden="true" className="size-4" />
        </div>
        <div className="text-muted-foreground">
          {perCustomer.previousMonth}: {formatUsd(perCustomer.previous)}
        </div>
      </CardFooter>
    </Card>
  )
}

export function SectionCards() {
  const [shown, setShown] = React.useState<string | null>(null)

  return (
    <section
      aria-label="Key metrics"
      className="flex flex-col gap-3 px-4 lg:px-6"
    >
      <PliantRegion
        id="acme-metrics"
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        slots={{
          revenue: <MetricCard metric={metric("revenue")} />,
          "new-customers": <MetricCard metric={metric("new-customers")} />,
          "active-accounts": <MetricCard metric={metric("active-accounts")} />,
          "growth-rate": <MetricCard metric={metric("growth-rate")} />,
        }}
      />
      {shown === revenuePerCustomerAsk && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RevenuePerCustomerCard />
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <SurfaceAsks
          target="acme-metrics"
          label="the metric cards"
          prompts={["show the cards in two columns"]}
        />
        <LocalAsks
          target="acme-metrics"
          label="the metric cards"
          more
          prompts={[revenuePerCustomerAsk, "add a card for profit margin"]}
          onShow={setShown}
        />
      </div>
    </section>
  )
}
