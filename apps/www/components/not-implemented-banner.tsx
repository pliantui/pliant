import { cn } from "cn"
import { ConstructionIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function NotImplementedBanner({ className }: { className?: string }) {
  return (
    <Alert
      role="note"
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className={cn(
        "not-typeset rounded-2xl border-amber-200 bg-amber-50 text-amber-950 md:-mx-1 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-50",
        className
      )}
    >
      <ConstructionIcon aria-hidden="true" />
      <AlertTitle>Not fully implemented yet</AlertTitle>
      <AlertDescription className="text-current/80">
        Parts of what this page describes aren&apos;t in Pliant yet.
      </AlertDescription>
    </Alert>
  )
}
