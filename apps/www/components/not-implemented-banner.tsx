import { cn } from "cn"
import { ConstructionIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function NotImplementedBanner({
  variant = "page",
  className,
  children,
}: {
  variant?: "page" | "preview"
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Alert
      role="note"
      // Found by the launch check, which keeps unfinished work off the
      // launched site.
      data-unfinished="not-implemented"
      data-variant={variant}
      className={cn(
        "not-typeset border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-50",
        variant === "page"
          ? "rounded-2xl md:-mx-1"
          : "rounded-none border-x-0 border-t-0",
        className
      )}
    >
      <ConstructionIcon aria-hidden="true" />
      <AlertTitle>Not fully implemented yet</AlertTitle>
      <AlertDescription className="text-current/80">
        {children ??
          (variant === "page"
            ? "This page shows how the feature will work, with sample data. Parts of it aren't in Pliant yet."
            : "This preview uses sample data to show how the feature will work.")}
      </AlertDescription>
    </Alert>
  )
}
