import { site } from "@/lib/site"

// The name the shadcn CLI installs a Pliant registry item by, like
// `@pliant/pliant-region`. The registry's own files refer to other Pliant
// items by URL, which this turns into the same short name.
export function pliantItemName(item: string) {
  const name = /\/r\/([a-z0-9-]+)\.json$/.exec(item)?.[1] ?? item
  return `@pliant/${name}`
}

// Pliant's registry on the production site, and on the site this build
// serves, such as a preview.
const registryOrigins = ["https://pliantui.dev", site.url]

export function isPliantItemUrl(item: string) {
  return registryOrigins.some(
    (origin) =>
      item.startsWith(`${origin}/r/`) &&
      /^[a-z0-9-]+\.json$/.test(item.slice(origin.length + 3))
  )
}
