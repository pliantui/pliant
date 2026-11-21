import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { formatCommand, runCommand } from "./run-command"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "pliantui-run-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe("runCommand", () => {
  it("runs the command in the given directory", async () => {
    await runCommand(
      process.execPath,
      ["-e", "require('fs').writeFileSync('ran.txt', process.cwd())"],
      cwd
    )

    const written = await readFile(path.join(cwd, "ran.txt"), "utf8")
    expect(path.basename(written)).toBe(path.basename(cwd))
  })

  it("rejects with the command and exit code when it fails", async () => {
    await expect(
      runCommand(process.execPath, ["-e", "process.exit(3)"], cwd)
    ).rejects.toThrow(
      `${process.execPath} -e process.exit(3) exited with code 3.`
    )
  })

  it("rejects when the command doesn't exist", async () => {
    await expect(
      runCommand("pliantui-no-such-command", [], cwd)
    ).rejects.toThrow()
  })
})

describe("formatCommand", () => {
  it("joins the command and its arguments", () => {
    expect(formatCommand("pnpm", ["add", "@pliantui/react"])).toBe(
      "pnpm add @pliantui/react"
    )
  })
})
