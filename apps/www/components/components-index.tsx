import Link from "next/link"
import type { Item } from "fumadocs-core/page-tree"

import {
  componentGroupOf,
  componentGroups,
} from "@/lib/components/component-groups"
import { source } from "@/lib/source"

// The component pages, in the order the components' `meta.json` lists them.
function componentPages(): Item[] {
  const folder = source
    .getPageTree()
    .children.find(
      (node) => node.type === "folder" && node.index?.url === "/docs/components"
    )
  if (folder?.type !== "folder") return []
  return folder.children.filter((node): node is Item => node.type === "page")
}

// Every component, grouped by what it's for, as links to their pages.
export function ComponentsIndex() {
  const pages = componentPages()

  return (
    <div data-not-typeset className="mt-8 flex flex-col gap-10">
      {componentGroups.map((group) => {
        const inGroup = pages.filter(
          (page) => componentGroupOf[page.url.split("/").pop() ?? ""] === group
        )
        if (inGroup.length === 0) return null
        const id = `group-${group.toLowerCase().replaceAll(" ", "-")}`
        return (
          <section key={group} aria-labelledby={id}>
            <h2
              id={id}
              className="mb-4 text-sm font-medium text-muted-foreground"
            >
              {group}
            </h2>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
              {inGroup.map((page) => (
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
