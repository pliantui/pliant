import { GitHubIcon } from "@/components/github-icon"
import { Button } from "@/components/ui/button"
import { formatStarCount, getStarCount } from "@/lib/github"
import { site } from "@/lib/site"

export async function GitHubLink() {
  const stars = await getStarCount()

  return (
    <Button asChild size="sm" variant="ghost" className="h-8 shadow-none">
      <a href={site.repository} target="_blank" rel="noreferrer">
        <GitHubIcon />
        <span className="sr-only">GitHub</span>
        {stars !== null && (
          <span className="w-fit text-xs text-muted-foreground tabular-nums">
            {formatStarCount(stars)}
            <span className="sr-only"> stars</span>
          </span>
        )}
      </a>
    </Button>
  )
}
