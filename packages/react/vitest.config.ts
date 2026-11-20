import { readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"

const { version } = JSON.parse(
  // Read through the dependency link rather than the sibling folder, so the
  // config also works from a copy of the package, such as Stryker's sandbox.
  readFileSync(
    new URL("node_modules/@pliantui/core/package.json", import.meta.url),
    "utf8"
  )
) as { version: string }

export default defineConfig({
  define: { __PLIANT_CORE_VERSION__: JSON.stringify(version) },
  test: {
    environment: "happy-dom",
  },
})
