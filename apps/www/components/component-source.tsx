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
  className,
}: {
  // The file's path from the site's root, like `registry/pliant/pliant-region.tsx`.
  src: string
  title?: string | undefined
  className?: string | undefined
}) {
  const source = await readFile(join(process.cwd(), src), "utf8")
  const code = source
    // Regions mark the parts docs include; the whole file is shown here.
    .replace(/^\s*\/\/ #(end)?region.*\n/gm, "")
    .replaceAll("@/registry/pliant/", "@/components/pliant/")
    .trimEnd()
  const lang = src.split(".").pop() ?? "tsx"
  return (
    <ComponentCode
      code={code}
      language={lang}
      title={title}
      className={className}
    />
  )
}

// Highlighted code with a copy button, styled like the docs' code blocks.
export async function ComponentCode({
  code,
  language,
  title,
  className,
}: {
  code: string
  language: string
  title?: string | undefined
  className?: string | undefined
}) {
  const html = await highlightCode(code, language)
  return (
    <figure
      data-rehype-pretty-code-figure=""
      className={cn("[&>div>pre]:max-h-96", className)}
    >
      {title && (
        <figcaption
          data-rehype-pretty-code-title=""
          data-language={language}
          className="flex items-center gap-2 text-code-foreground [&_svg]:size-4 [&_svg]:text-code-foreground [&_svg]:opacity-70"
        >
          {getIconForLanguageExtension(language)}
          {title}
        </figcaption>
      )}
      <CopyButton value={code} />
      <div
        data-not-typeset
        className="[&>pre]:no-scrollbar [&>pre]:overflow-auto [&>pre]:px-4 [&>pre]:py-3.5 [&>pre]:outline-none [&>pre]:focus-visible:ring-[3px] [&>pre]:focus-visible:ring-ring/50"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  )
}
