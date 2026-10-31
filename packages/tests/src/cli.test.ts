import { createRequire } from "node:module"
import path from "node:path"
import { execa } from "execa"
import packageJson from "pliantui/package.json" with { type: "json" }
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const cli = path.join(
  path.dirname(require.resolve("pliantui/package.json")),
  "dist/index.js"
)

describe("pliantui", () => {
  it("prints its version", async () => {
    const { stdout } = await execa("node", [cli, "--version"])
    expect(stdout).toBe(packageJson.version)
  })
})
