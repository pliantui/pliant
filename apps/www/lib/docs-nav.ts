import type { Folder, Item, Root } from "fumadocs-core/page-tree"

export interface DocsGroup {
  id: string
  name: Folder["name"]
  pages: Item[]
}

// A folder appears at the top level through its index page.
export function getDocsSections(tree: Root): Item[] {
  return tree.children.flatMap((node) => {
    if (node.type === "page") return [node]
    if (node.type === "folder" && node.index) {
      return [{ ...node.index, name: node.name }]
    }
    return []
  })
}

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
