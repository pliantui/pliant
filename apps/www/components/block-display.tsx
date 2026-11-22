import { readFile } from "node:fs/promises"
import { dirname, join, normalize } from "node:path"

import { BlockViewer } from "@/components/block-viewer"
import type { Block } from "@/lib/blocks/blocks"
import { highlightCode } from "@/lib/highlight-code"

function withoutExtension(path: string) {
  return path.replace(/\.tsx?$/, "")
}

// Points imports of the block's own files, and of the registry's
// components, where they sit in an app that installed the block.
function rewriteImports(code: string, src: string, block: Block) {
  return code.replace(/from "([^"]+)"/g, (statement, specifier: string) => {
    if (specifier.startsWith("@/registry/pliant/")) {
      return `from "${specifier.replace("@/registry/pliant/", "@/components/pliant/")}"`
    }
    const path = specifier.startsWith("@/")
      ? specifier.slice(2)
      : specifier.startsWith(".")
        ? normalize(join(dirname(src), specifier))
        : undefined
    const file = block.files.find(
      (entry) => path !== undefined && withoutExtension(entry.src) === path
    )
    return file ? `from "@/${withoutExtension(file.target)}"` : statement
  })
}

// One block on the blocks page: its live preview, and its files to copy.
export async function BlockDisplay({
  block,
  children,
}: {
  block: Block
  children: React.ReactNode
}) {
  const files = await Promise.all(
    block.files.map(async ({ src, target }) => {
      const source = await readFile(join(process.cwd(), src), "utf8")
      const code = rewriteImports(source, src, block).trimEnd()
      return { target, code, html: await highlightCode(code, "tsx") }
    })
  )

  return (
    <BlockViewer
      name={block.name}
      description={block.description}
      components={block.components}
      files={files}
    >
      {children}
    </BlockViewer>
  )
}
