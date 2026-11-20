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

// The date filter tests need a zone behind UTC. Set for the whole process,
// because a zone set inside a worker thread, as Stryker runs the tests,
// doesn't apply to it.
// eslint-disable-next-line turbo/no-undeclared-env-vars -- set, not read
process.env.TZ = "America/New_York"

export default defineConfig({
  define: { __PLIANT_CORE_VERSION__: JSON.stringify(version) },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
})
