import Link from "next/link"

import {
  componentGroups,
  componentPages,
} from "@/lib/components/component-groups"

// Every component, grouped by what it's for, as links to their pages.
export function ComponentsIndex() {
  return (
    <div data-not-typeset className="mt-8 flex flex-col gap-10">
      {componentGroups.map((group) => {
        const pages = componentPages.filter((page) => page.group === group)
        if (pages.length === 0) return null
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
              {pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/components/${page.slug}`}
                    className="text-lg font-medium underline-offset-4 hover:underline md:text-base"
                  >
                    {page.title}
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
