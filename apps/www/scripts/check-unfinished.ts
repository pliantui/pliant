import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The production site. A build for it must not show anything unfinished;
// builds for any other address, like previews, may.
const productionHosts = ["pliantui.dev", "www.pliantui.dev"]

// Banners and placeholders mark their rendered HTML with this.
const marker = /data-unfinished="([a-z-]+)"/g

interface UnfinishedPage {
  file: string
  kinds: string[]
}

function* htmlFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* htmlFiles(path)
    else if (entry.name.endsWith(".html")) yield path
  }
}

function isProduction(siteUrl: string | undefined) {
  if (!siteUrl) return false
  try {
    return productionHosts.includes(new URL(siteUrl).hostname)
  } catch {
    return false
  }
}

// Lists the prerendered pages that still show a banner or a placeholder.
export function findUnfinishedPages(directory: string): UnfinishedPage[] {
  const pages: UnfinishedPage[] = []
  for (const file of htmlFiles(directory)) {
    const kinds = new Set(
      Array.from(
        readFileSync(file, "utf8").matchAll(marker),
        (match) => match[1] ?? ""
      )
    )
    if (kinds.size > 0) {
      pages.push({ file: relative(directory, file), kinds: [...kinds].sort() })
    }
  }
  return pages.sort((a, b) => a.file.localeCompare(b.file))
}

export function checkUnfinished(
  siteUrl: string | undefined,
  directory: string
) {
  // No home page means the build output isn't where this check looks, so it
  // would find nothing and pass without checking anything.
  const found = [...htmlFiles(directory)].some(
    (file) => relative(directory, file) === "index.html"
  )
  if (!found) {
    throw new Error(`No prerendered home page in ${directory}.`)
  }
  const pages = findUnfinishedPages(directory)
  const production = isProduction(siteUrl)
  return { ok: !production || pages.length === 0, production, pages }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = resolve(import.meta.dirname, "../.next/server/app")
  const { ok, production, pages } = checkUnfinished(
    process.env.NEXT_PUBLIC_SITE_URL,
    directory
  )
  const list = pages.map((page) => `  ${page.file}: ${page.kinds.join(", ")}`)
  if (!ok) {
    console.error(
      [
        `This build is for the production site, but ${String(pages.length)} pages still show unfinished work:`,
        ...list,
      ].join("\n")
    )
    process.exit(1)
  }
  console.log(
    production
      ? "Unfinished work check: nothing unfinished."
      : `Unfinished work check: ${String(pages.length)} pages show unfinished work, allowed outside the production site.`
  )
}
