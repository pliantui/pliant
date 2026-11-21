import { site } from "@/lib/site"

const repositoryApi = site.repository.replace(
  "https://github.com/",
  "https://api.github.com/repos/"
)

// Read once when the site is built, so the pages stay fully static and
// visitors never reach GitHub. The count updates on each deploy. Returns null
// when GitHub can't be reached, and the pages then show no count.
export async function getStarCount(): Promise<number | null> {
  try {
    const response = await fetch(repositoryApi, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "force-cache",
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null
    const repository: unknown = await response.json()
    if (
      typeof repository === "object" &&
      repository !== null &&
      "stargazers_count" in repository &&
      typeof repository.stargazers_count === "number"
    ) {
      return repository.stargazers_count
    }
    return null
  } catch {
    return null
  }
}

export function formatStarCount(count: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count)
}
