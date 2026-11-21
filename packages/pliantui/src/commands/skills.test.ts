import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { stripVTControlCharacters } from "node:util"
import prompts from "prompts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { skills } from "./skills"

class ExitError extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`)
  }
}

let cwd: string
let output: string[]

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "pliantui-skills-"))
  output = []
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    output.push(stripVTControlCharacters(args.join(" ")))
  })
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code)
  })
  setTerminal(false)
})

afterEach(async () => {
  vi.restoreAllMocks()
  setTerminal(false)
  await rm(cwd, { recursive: true, force: true })
})

function setTerminal(isTTY: boolean) {
  Object.defineProperty(process.stdin, "isTTY", {
    value: isTTY,
    configurable: true,
  })
}

async function run(...args: string[]) {
  try {
    await skills.parseAsync(
      args[0] === "add" ? [...args, "--cwd", cwd] : args,
      { from: "user" }
    )
  } catch (error) {
    if (error instanceof ExitError) {
      return error.code
    }
    throw error
  }
  return 0
}

function printed() {
  return output.join("\n")
}

function read(...segments: string[]) {
  return readFile(path.join(cwd, ...segments), "utf8")
}

describe("pliantui skills list", () => {
  it("prints each skill with its description", async () => {
    expect(await run("list")).toBe(0)

    expect(printed()).toMatch(/^setup\n {2}Add Pliant to a Next\.js/m)
  })
})

describe("pliantui skills add", () => {
  it("puts skills in .agents/skills by default", async () => {
    expect(await run("add")).toBe(0)

    expect(await read(".agents", "skills", "setup", "SKILL.md")).toMatch(
      /^---\nname: setup\n/
    )
    expect(printed()).toContain("Added setup in .agents/skills/setup.")
  })

  it("puts skills in .claude/skills when the project has a .claude folder", async () => {
    await mkdir(path.join(cwd, ".claude"))

    expect(await run("add")).toBe(0)

    expect(await read(".claude", "skills", "setup", "SKILL.md")).toMatch(
      /^---\nname: setup\n/
    )
    await expect(
      read(".agents", "skills", "setup", "SKILL.md")
    ).rejects.toThrow()
  })

  it("puts skills where --dir says", async () => {
    await mkdir(path.join(cwd, ".claude"))

    expect(await run("add", "setup", "--dir", "tools/skills")).toBe(0)

    expect(await read("tools", "skills", "setup", "SKILL.md")).toMatch(
      /^---\nname: setup\n/
    )
  })

  it("says so when the skills are already up to date", async () => {
    await run("add")
    output = []

    expect(await run("add")).toBe(0)

    expect(printed()).toContain("setup is already up to date")
    expect(printed()).not.toContain("✔")
  })

  it("stops on a skill that doesn't exist and writes nothing", async () => {
    expect(await run("add", "nope")).toBe(1)

    expect(printed()).toContain("There is no skill named nope")
    expect(printed()).toContain("Available skills: setup")
    await expect(
      read(".agents", "skills", "setup", "SKILL.md")
    ).rejects.toThrow()
  })

  describe("when a skill has been changed", () => {
    const edited = "my own notes\n"
    const file = [".agents", "skills", "setup", "SKILL.md"]

    beforeEach(async () => {
      await run("add")
      await writeFile(path.join(cwd, ...file), edited)
      output = []
    })

    it("needs --yes without a terminal, and leaves the file alone", async () => {
      expect(await run("add")).toBe(1)

      expect(printed()).toContain("needs an interactive terminal")
      expect(await read(...file)).toBe(edited)
    })

    it("overwrites it with --yes", async () => {
      expect(await run("add", "--yes")).toBe(0)

      expect(await read(...file)).toMatch(/^---\nname: setup\n/)
      expect(printed()).toContain("Updated setup")
    })

    it("overwrites it when the user agrees", async () => {
      setTerminal(true)
      prompts.inject([true])

      expect(await run("add")).toBe(0)

      expect(await read(...file)).toMatch(/^---\nname: setup\n/)
    })

    it("keeps it when the user declines", async () => {
      setTerminal(true)
      prompts.inject([false])

      expect(await run("add")).toBe(0)

      expect(await read(...file)).toBe(edited)
      expect(printed()).toContain("Skipped setup")
    })

    it("stops when the user cancels", async () => {
      setTerminal(true)
      prompts.inject([new Error("cancelled")])

      expect(await run("add")).toBe(0)

      expect(await read(...file)).toBe(edited)
      expect(printed()).toContain("Cancelled")
    })
  })
})
