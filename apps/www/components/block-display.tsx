import { readFile } from "node:fs/promises"
import { dirname, join, normalize } from "node:path"

import { BlockViewer } from "@/components/block-viewer"
import type { Block } from "@/lib/blocks/blocks"
import { highlightCode } from "@/lib/highlight-code"
import { pliantItemName } from "@/lib/registry-name"

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

function isRegistry(value: unknown): value is { items: { name: string }[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    Array.isArray(value.items)
  )
}

// The command that adds the published components a block uses, checked
// against `registry.json` so it only names items the registry serves.
async function installCommand(components: readonly string[]) {
  if (components.length === 0) return undefined
  const registry: unknown = JSON.parse(
    await readFile(join(process.cwd(), "registry.json"), "utf8")
  )
  const published = isRegistry(registry)
    ? registry.items.map((item) => item.name)
    : []
  for (const name of components) {
    if (!published.includes(name)) {
      throw new Error(`No registry item named ${name}`)
    }
  }
  return `npx shadcn@latest add ${components.map(pliantItemName).join(" ")}`
}

// One block on the blocks page: its live preview, and its files to copy.
export async function BlockDisplay({
  block,
  children,
}: {
  block: Block
  children: React.ReactNode
}) {
  const command = await installCommand(block.components)
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
      command={command}
      files={files}
    >
      {children}
    </BlockViewer>
  )
}
