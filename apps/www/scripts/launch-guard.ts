import { readdirSync, readFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The address the finished site launches at. A build for it must not show
// anything unfinished; builds for any other address, like previews, may.
export const launchUrl = "https://pliantui.dev"

// Banners, placeholders and scripted asks mark their rendered HTML with this.
const marker = /data-unfinished="([a-z-]+)"/g

export interface UnfinishedPage {
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

// Lists the prerendered pages that still show a banner, a placeholder or a
// scripted ask.
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

export function checkLaunch(siteUrl: string | undefined, directory: string) {
  const pages = findUnfinishedPages(directory)
  const launching = siteUrl?.replace(/\/+$/, "") === launchUrl
  return { ok: !launching || pages.length === 0, launching, pages }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const directory = resolve(import.meta.dirname, "../.next/server/app")
  const { ok, launching, pages } = checkLaunch(
    process.env.NEXT_PUBLIC_SITE_URL,
    directory
  )
  const list = pages.map((page) => `  ${page.file}: ${page.kinds.join(", ")}`)
  if (!ok) {
    console.error(
      [
        `This build is for ${launchUrl}, but ${String(pages.length)} pages still show unfinished work:`,
        ...list,
      ].join("\n")
    )
    process.exit(1)
  }
  console.log(
    launching
      ? "Launch check: nothing unfinished."
      : `Launch check: ${String(pages.length)} pages show unfinished work, allowed outside ${launchUrl}.`
  )
}
