import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { cn } from "cn"

import { CopyButton } from "@/components/copy-button"
import { getIconForLanguageExtension } from "@/components/icons"
import { highlightCode } from "@/lib/highlight-code"

// Shows a file from the site as a reader would have it in their app, with
// the registry's components imported from where the CLI installs them.
export async function ComponentSource({
  src,
  title,
  language,
  className,
}: {
  // The file's path from the site's root, like `registry/pliant/pliant-region.tsx`.
  src: string
  title?: string | undefined
  language?: string | undefined
  className?: string | undefined
}) {
  const source = await readFile(join(process.cwd(), src), "utf8")
  const code = source
    .replaceAll("@/registry/pliant/", "@/components/pliant/")
    .replaceAll("@/registry/examples/", "@/components/")
    .trimEnd()
  const lang = language ?? src.split(".").pop() ?? "tsx"
  const html = await highlightCode(code, lang)

  return (
    <figure
      data-rehype-pretty-code-figure=""
      className={cn("[&>div>pre]:max-h-96", className)}
    >
      {title && (
        <figcaption
          data-rehype-pretty-code-title=""
          data-language={lang}
          className="flex items-center gap-2 text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70"
        >
          {getIconForLanguageExtension(lang)}
          {title}
        </figcaption>
      )}
      <CopyButton value={code} />
      <div
        data-not-typeset
        className="[&>pre]:no-scrollbar [&>pre]:overflow-auto [&>pre]:px-4 [&>pre]:py-3.5 [&>pre]:outline-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  )
}
