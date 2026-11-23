import { ConstructionIcon } from "lucide-react"

// A quiet note on a docs page that part of what it describes isn't in Pliant
// yet.
export function NotImplementedBanner({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <div
      role="note"
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished="not-implemented"
      className="not-typeset mt-6 flex gap-2 text-sm text-muted-foreground"
    >
      <ConstructionIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-500"
      />
      {/* A div, not a p: MDX wraps the children in paragraphs of their own. */}
      <div className="[&>p]:inline">
        <span className="font-medium text-foreground">
          Not fully implemented yet.
        </span>{" "}
        {children ?? "Parts of what this page describes aren't in Pliant yet."}
      </div>
    </div>
  )
}
