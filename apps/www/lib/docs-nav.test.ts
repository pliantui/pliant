import type { Root } from "fumadocs-core/page-tree"
import { describe, expect, it } from "vitest"

import { getDocsGroups } from "@/lib/docs-nav"

const tree: Root = {
  name: "Docs",
  children: [
    { type: "separator", name: "Get started" },
    { type: "page", name: "Introduction", url: "/docs" },
    { type: "separator", name: "Components" },
    {
      type: "folder",
      name: "Components",
      index: { type: "page", name: "Overview", url: "/docs/components" },
      children: [
        {
          type: "page",
          name: "PliantRoot",
          url: "/docs/components/pliant-root",
        },
        { type: "page", name: "Region", url: "/docs/components/region" },
      ],
    },
    { type: "separator", name: "Concepts" },
    { type: "page", name: "Layers", url: "/docs/concepts/layers" },
  ],
}

describe("getDocsGroups", () => {
  it("splits the top level into groups at each separator", () => {
    expect(getDocsGroups(tree).map((group) => group.name)).toEqual([
      "Get started",
      "Components",
      "Concepts",
    ])
  })

  it("lists a folder by its index, under the folder's name, then its pages", () => {
    expect(getDocsGroups(tree)[1]?.pages).toEqual([
      { type: "page", name: "Components", url: "/docs/components" },
      { type: "page", name: "PliantRoot", url: "/docs/components/pliant-root" },
      { type: "page", name: "Region", url: "/docs/components/region" },
    ])
  })
})
