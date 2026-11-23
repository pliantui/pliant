"use client"

import { DemoFrame } from "@/components/demo/demo-frame"
import { useScriptedAsks } from "@/components/demo/use-scripted-asks"
import { keyMetricsAsks, refundRateAsk } from "@/lib/demo/asks"

const percent = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 1,
})

// The key metrics preview, with the card the refund rate ask adds. A stat
// card isn't in Pliant yet, so the preview draws it.
export function KeyMetricsFrame({
  refundRate,
  toolbar,
  children,
}: {
  refundRate: { quarter: string; rate: number }
  toolbar?: React.ReactNode
  children: React.ReactNode
}) {
  const scripted = useScriptedAsks()

  return (
    <DemoFrame
      target="key-metrics"
      label="key metrics"
      asks={keyMetricsAsks}
      toolbar={toolbar}
      mocked={{
        label: "the metric cards",
        asks: [refundRateAsk],
        scripted,
        note: "A stat card isn't in Pliant yet, so the refund rate card is drawn by a scripted answer.",
      }}
    >
      {children}
      {scripted.has(refundRateAsk) && (
        <div
          role="group"
          aria-label={`Refund rate, ${refundRate.quarter}`}
          className="flex w-full flex-col gap-1 rounded-xl border bg-background p-3 sm:w-1/2 lg:w-1/4"
        >
          <span className="text-xs text-muted-foreground">
            Refund rate, {refundRate.quarter}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {percent.format(refundRate.rate)}
          </span>
        </div>
      )}
    </DemoFrame>
  )
}
