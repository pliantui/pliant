import type { Folder, Item, Root } from "fumadocs-core/page-tree"

export interface DocsGroup {
  id: string
  name: Folder["name"]
  pages: Item[]
}

// The top level of the docs: each page, and each folder by its index page.
export function getDocsSections(tree: Root): Item[] {
  return tree.children.flatMap((node) => {
    if (node.type === "page") return [node]
    if (node.type === "folder" && node.index) {
      return [{ ...node.index, name: node.name }]
    }
    return []
  })
}

// One group per folder, listing the pages inside it.
export function getDocsGroups(tree: Root): DocsGroup[] {
  return tree.children.flatMap((node) => {
    if (node.type !== "folder") return []
    const pages = node.children.filter(
      (child): child is Item => child.type === "page"
    )
    if (pages.length === 0) return []
    return [{ id: node.$id ?? pages[0]?.url ?? "", name: node.name, pages }]
  })
}
