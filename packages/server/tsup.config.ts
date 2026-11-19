import { readFileSync } from "node:fs"
import { defineConfig } from "tsup"

const { version } = JSON.parse(
  readFileSync(new URL("../core/package.json", import.meta.url), "utf8")
) as { version: string }

export default defineConfig({
  entry: ["src/index.ts", "src/recordings.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2023",
  treeshake: true,
  removeNodeProtocol: false,
  define: { __PLIANT_CORE_VERSION__: JSON.stringify(version) },
})
