import { cn } from "cn"

const labels = {
  "not-implemented": "Not fully implemented yet",
  scripted: "Scripted: plays a hand-written answer",
} as const

// A small amber dot after the name of something that isn't fully built,
// like the dot shadcn puts after a new item. It sits inside the link, tab or
// button it marks, so its hidden text joins that control's accessible name,
// after a comma.
export function UnfinishedDot({
  kind = "not-implemented",
  className,
}: {
  kind?: keyof typeof labels
  className?: string
}) {
  const label = labels[kind]
  return (
    <span
      // Found by the unfinished work check, which keeps unfinished work out of
      // a build for the production site.
      data-unfinished={kind}
      title={label}
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full bg-amber-600 dark:bg-amber-400",
        className
      )}
    >
      <span className="sr-only">
        , {kind === "scripted" ? "Scripted" : label}
      </span>
    </span>
  )
}
