import { cn } from "cn"

import { GitHubIcon } from "@/components/github-icon"
import { formatStarCount } from "@/lib/github"
import { site } from "@/lib/site"

export function GitHubLink({
  stars,
  showLabel = true,
  className,
}: {
  stars: number | null
  showLabel?: boolean
  className?: string
}) {
  return (
    <a
      href={site.repository}
      className={className}
      target="_blank"
      rel="noreferrer"
    >
      <GitHubIcon className="size-4" />
      <span className={cn(!showLabel && "sr-only")}>GitHub</span>
      {stars !== null && (
        <span className="text-xs text-fd-muted-foreground tabular-nums">
          {formatStarCount(stars)}
          <span className="sr-only"> stars</span>
        </span>
      )}
    </a>
  )
}
