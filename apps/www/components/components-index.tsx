import Link from "next/link"
import type { Item } from "fumadocs-core/page-tree"

import { source } from "@/lib/source"

interface ComponentGroup {
  name: string
  pages: Item[]
}

// The component pages under the separators of the components' `meta.json`,
// in its order.
function componentGroups(): ComponentGroup[] {
  const folder = source
    .getPageTree()
    .children.find(
      (node) => node.type === "folder" && node.index?.url === "/docs/components"
    )
  if (folder?.type !== "folder") return []
  const groups: ComponentGroup[] = []
  for (const node of folder.children) {
    if (node.type === "separator") {
      groups.push({
        name: typeof node.name === "string" ? node.name : "",
        pages: [],
      })
    } else if (node.type === "page") {
      groups.at(-1)?.pages.push(node)
    }
  }
  return groups.filter((group) => group.pages.length > 0)
}

// Every component, grouped by what it's for, as links to their pages.
export function ComponentsIndex() {
  return (
    <div data-not-typeset className="mt-8 flex flex-col gap-10">
      {componentGroups().map((group) => {
        const id = `group-${group.name.toLowerCase().replaceAll(" ", "-")}`
        return (
          <section key={group.name} aria-labelledby={id}>
            <h2
              id={id}
              className="mb-4 text-sm font-medium text-muted-foreground"
            >
              {group.name}
            </h2>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
              {group.pages.map((page) => (
                <li key={page.url}>
                  <Link
                    href={page.url}
                    className="text-lg font-medium underline-offset-4 hover:underline md:text-base"
                  >
                    {page.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
