import { execa } from "execa"
import packageJson from "pliantui/package.json" with { type: "json" }
import { describe, expect, it } from "vitest"

import { cliPath } from "./helpers"

describe("pliantui", () => {
  it("prints its version", async () => {
    const { stdout } = await execa("node", [cliPath, "--version"])
    expect(stdout).toBe(packageJson.version)
  })
})
