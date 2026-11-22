import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { blocks } from "./blocks"

function registryItems() {
  const registry: unknown = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../registry.json"), "utf8")
  )
  if (
    typeof registry !== "object" ||
    registry === null ||
    !("items" in registry) ||
    !Array.isArray(registry.items)
  ) {
    throw new Error("registry.json has no items")
  }
  return registry.items.map((item: { name: string }) => item.name)
}

describe("blocks", () => {
  it("offers only components that the registry publishes", () => {
    const published = registryItems()
    for (const block of blocks) {
      for (const component of block.components) {
        expect(published).toContain(component)
      }
    }
  })
})
