import { readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"

const { version } = JSON.parse(
  readFileSync(new URL("../core/package.json", import.meta.url), "utf8")
) as { version: string }

export default defineConfig({
  define: { __PLIANT_CORE_VERSION__: JSON.stringify(version) },
})
