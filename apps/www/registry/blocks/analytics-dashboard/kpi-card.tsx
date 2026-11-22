import { useId } from "react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function KpiCard({
  label,
  value,
  definition,
}: {
  label: string
  value: string
  definition: string
}) {
  const labelId = useId()

  return (
    <Card
      role="group"
      aria-labelledby={labelId}
      className="gap-2 border-border py-4"
    >
      <CardHeader>
        <CardDescription id={labelId}>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">
        {definition}
      </CardFooter>
    </Card>
  )
}
