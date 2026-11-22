import { cn } from "cn"
import { ConstructionIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// `page` sits at the top of a page. `preview` marks one preview, and says
// which part of it isn't built.
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
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className={cn(
        "not-typeset border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-50",
        variant === "page"
          ? "rounded-2xl md:-mx-1"
          : "rounded-lg px-3 py-2 text-xs has-[>svg]:grid-cols-[calc(var(--spacing)*3.5)_1fr] has-[>svg]:gap-x-2 [&>svg]:size-3.5 [&>svg]:translate-y-px",
        className
      )}
    >
      <ConstructionIcon aria-hidden="true" />
      {variant === "page" ? (
        <>
          <AlertTitle>Not fully implemented yet</AlertTitle>
          <AlertDescription className="text-current/80">
            {children ??
              "Parts of what this page describes aren't in Pliant yet."}
          </AlertDescription>
        </>
      ) : (
        <AlertDescription className="text-xs text-current/80">
          <p>
            <strong className="font-medium text-current">
              Not fully implemented yet.
            </strong>{" "}
            {children}
          </p>
        </AlertDescription>
      )}
    </Alert>
  )
}
