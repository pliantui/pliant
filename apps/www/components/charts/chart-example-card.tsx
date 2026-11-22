"use client"

import { ResetControl } from "@/components/demo/reset-control"
import {
  ScriptedAsks,
  type ScriptedAsksState,
} from "@/components/demo/scripted-frame"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// A card of the charts page: a table, dashboard or chart, with the asks
// that change it in place and a Reset.
export function ChartExampleCard({
  id,
  title,
  description,
  label,
  asks,
  scripted,
  children,
}: {
  id: string
  title: string
  description: string
  // What the asks and Reset change, as they read it, like "the table".
  label: string
  asks: readonly string[]
  scripted: ScriptedAsksState
  children: React.ReactNode
}) {
  return (
    <Card
      role="region"
      aria-labelledby={`${id}-title`}
      className="min-w-0 gap-4"
    >
      <CardHeader>
        <CardTitle id={`${id}-title`}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <ResetControl
            customized={scripted.applied.length > 0}
            label={label}
            onReset={scripted.reset}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {children}
      </CardContent>
      <CardFooter className="mt-auto border-t pt-4 [.border-t]:pt-4">
        <ScriptedAsks label={label} asks={asks} scripted={scripted} />
      </CardFooter>
    </Card>
  )
}
