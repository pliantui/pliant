"use client"

import * as React from "react"

import {
  CustomizeControl,
  CustomizeSurface,
  focusFirstAsk,
} from "@/components/demo/customize-control"
import { ScriptedAsks } from "@/components/demo/scripted-asks"
import type { ScriptedAsksState } from "@/components/demo/use-scripted-asks"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// A card of the charts page: a table or dashboard, the ask that charts it
// in place, the follow-up asks that reshape the chart, and its Customize
// menu.
export function ChartExampleCard({
  id,
  title,
  description,
  label,
  asks,
  scripted,
  followUps,
  children,
}: {
  id: string
  title: string
  description: string
  // What the asks and Reset change, as they read it, like "the table".
  label: string
  asks: readonly string[]
  scripted: ScriptedAsksState
  // The asks that reshape the chart, once there is one.
  followUps?:
    | { label: string; asks: readonly string[]; scripted: ScriptedAsksState }
    | undefined
  children: React.ReactNode
}) {
  const card = React.useRef<HTMLDivElement>(null)
  const options = {
    customized: scripted.applied.length > 0,
    onAsk: () => {
      focusFirstAsk(card.current)
    },
    onReset: () => {
      scripted.reset()
      followUps?.scripted.reset()
    },
  }

  return (
    <Card
      ref={card}
      role="region"
      aria-labelledby={`${id}-title`}
      className="min-w-0 gap-4"
    >
      <CardHeader>
        <CardTitle id={`${id}-title`}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <CustomizeControl label={label} {...options} />
        </CardAction>
      </CardHeader>
      <CustomizeSurface {...options}>
        <CardContent className="flex min-w-0 flex-col gap-4">
          {children}
        </CardContent>
      </CustomizeSurface>
      <CardFooter className="mt-auto flex-col items-stretch gap-3 border-t pt-4 [.border-t]:pt-4">
        <ScriptedAsks label={label} asks={asks} scripted={scripted} />
        {followUps && (
          <ScriptedAsks
            label={followUps.label}
            asks={followUps.asks}
            scripted={followUps.scripted}
          />
        )}
      </CardFooter>
    </Card>
  )
}
