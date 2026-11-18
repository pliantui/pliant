import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function KpiCard({
  id,
  label,
  value,
  definition,
}: {
  id: string
  label: string
  value: string
  definition: string
}) {
  return (
    <Card
      id={id}
      role="group"
      aria-label={label}
      className="gap-2 border-border py-4"
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
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
