import { describe, expect, it } from "vitest"

import { getActiveHref } from "@/lib/nav"

const items = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/components", label: "Components" },
  { href: "/examples/orders", label: "Examples" },
]

describe("getActiveHref", () => {
  it("marks the section that owns the page", () => {
    expect(getActiveHref("/", items)).toBe("/")
    expect(getActiveHref("/docs/installation", items)).toBe("/docs")
    expect(getActiveHref("/examples/tickets", items)).toBe("/examples/orders")
  })

  it("prefers the components over the docs on a component page", () => {
    expect(getActiveHref("/docs/components", items)).toBe("/docs/components")
    expect(getActiveHref("/docs/components/region", items)).toBe(
      "/docs/components"
    )
  })

  it("marks nothing outside every section", () => {
    expect(getActiveHref("/charts", items)).toBeUndefined()
  })
})
