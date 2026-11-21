import { site } from "@/lib/site"

export function SiteUrl({ path }: { path: `/${string}` }) {
  const href = `${site.url}${path}`
  return (
    <a href={href}>
      <code>{href}</code>
    </a>
  )
}
