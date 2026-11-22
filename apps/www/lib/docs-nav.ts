import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree"

import { componentPages } from "@/lib/components/component-groups"

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
  // The components sit in the docs, as on ui.shadcn.com, right after the
  // first steps. Their folder keeps its own order, so it's listed here.
  groups.splice(1, 0, {
    id: "components",
    name: "Components",
    pages: [
      { type: "page", name: "Components", url: "/docs/components" },
      ...componentPages.map(({ slug, title }): Item => ({
        type: "page",
        name: title,
        url: `/docs/components/${slug}`,
      })),
    ],
  })
  return groups.filter((group) => group.pages.length > 0)
}

// The pages before and after a component page, in the components' order.
export function getComponentNeighbours(url: string) {
  const pages = [
    { name: "Components", url: "/docs/components" },
    ...componentPages.map(({ slug, title }) => ({
      name: title,
      url: `/docs/components/${slug}`,
    })),
  ]
  const index = pages.findIndex((page) => page.url === url)
  if (index === -1) return undefined
  return { previous: pages[index - 1], next: pages[index + 1] }
}
