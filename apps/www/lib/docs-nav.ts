import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree"

export interface DocsGroup {
  id: string
  name: Folder["name"]
  pages: Item[]
}

// A folder is listed by its index page, under the folder's name, then its
// other pages.
function pagesOf(node: Node): Item[] {
  if (node.type === "page") return [node]
  if (node.type !== "folder") return []
  const pages = node.children.filter(
    (child): child is Item => child.type === "page"
  )
  return node.index ? [{ ...node.index, name: node.name }, ...pages] : pages
}

// The docs' separators split the top level into groups, as `meta.json`
// orders it.
export function getDocsGroups(tree: Root): DocsGroup[] {
  const groups: DocsGroup[] = []
  for (const node of tree.children) {
    if (node.type === "separator") {
      groups.push({
        id: node.$id ?? String(groups.length),
        name: node.name ?? "",
        pages: [],
      })
      continue
    }
    let group = groups.at(-1)
    if (!group) {
      group = { id: "start", name: "", pages: [] }
      groups.push(group)
    }
    group.pages.push(...pagesOf(node))
  }
  return groups.filter((group) => group.pages.length > 0)
}
