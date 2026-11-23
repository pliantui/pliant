import { describe, expect, it } from "vitest"

import { isPliantItemUrl, pliantItemName } from "@/lib/registry-name"

describe("pliantItemName", () => {
  it("names an item in the @pliant namespace", () => {
    expect(pliantItemName("pliant-region")).toBe("@pliant/pliant-region")
  })

  it("turns a registry URL into the item's name", () => {
    expect(
      pliantItemName("https://pliantui.dev/r/pliant-data-table.json")
    ).toBe("@pliant/pliant-data-table")
  })
})

describe("isPliantItemUrl", () => {
  it("tells a registry URL from a shadcn component name", () => {
    expect(
      isPliantItemUrl("https://pliantui.dev/r/pliant-data-table.json")
    ).toBe(true)
    expect(isPliantItemUrl("dropdown-menu")).toBe(false)
    expect(isPliantItemUrl("https://acme.dev/r/stat-card.json")).toBe(false)
  })
})
