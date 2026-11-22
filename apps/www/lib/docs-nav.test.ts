import type { Root } from "fumadocs-core/page-tree"
import { describe, expect, it } from "vitest"

import { getComponentNeighbours, getDocsGroups } from "@/lib/docs-nav"

const tree: Root = {
  name: "Docs",
  children: [
    { type: "separator", name: "Get started" },
    { type: "page", name: "Introduction", url: "/docs" },
    { type: "separator", name: "Concepts" },
    { type: "page", name: "Layers", url: "/docs/concepts/layers" },
  ],
}

describe("getDocsGroups", () => {
  it("lists the components right after the first steps", () => {
    const groups = getDocsGroups(tree)

    expect(groups.map((group) => group.name)).toEqual([
      "Get started",
      "Components",
      "Concepts",
    ])
    expect(groups[1]?.pages.slice(0, 3).map((page) => page.url)).toEqual([
      "/docs/components",
      "/docs/components/pliant-root",
      "/docs/components/region",
    ])
  })
})

describe("getComponentNeighbours", () => {
  it("steps through the components in order", () => {
    expect(getComponentNeighbours("/docs/components/region")).toEqual({
      previous: { name: "PliantRoot", url: "/docs/components/pliant-root" },
      next: { name: "Pre-paint", url: "/docs/components/pre-paint" },
    })
  })

  it("leaves other docs pages to the page tree", () => {
    expect(getComponentNeighbours("/docs/concepts/layers")).toBeUndefined()
  })
})
