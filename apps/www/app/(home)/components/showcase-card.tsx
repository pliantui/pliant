import { cn } from "cn"

import { AskChips } from "@/components/demo/ask-chips"
import { CustomizedReset } from "@/components/demo/customized-reset"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// A card of the home showcase: one live part of an app, with a Reset and
// the asks that reshape it.
export function ShowcaseCard({
  title,
  description,
  target,
  asks,
  className,
  children,
}: {
  title: string
  description: string
  // The node the card shows, which Reset and the asks change.
  target: string
  asks: readonly string[]
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card
      role="region"
      aria-labelledby={`${target}-title`}
      className={cn("min-w-0 gap-4", className)}
    >
      <CardHeader>
        <CardTitle id={`${target}-title`}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <CustomizedReset targets={[target]} label={title.toLowerCase()} />
        </CardAction>
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
      <CardFooter className="border-t pt-4 [.border-t]:pt-4">
        <AskChips target={target} label={title.toLowerCase()} prompts={asks} />
      </CardFooter>
    </Card>
  )
}
