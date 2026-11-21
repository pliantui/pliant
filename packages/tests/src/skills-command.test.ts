import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import { runCli } from "./helpers"

const projects: string[] = []

afterAll(async () => {
  await Promise.all(
    projects.map((project) => rm(project, { recursive: true, force: true }))
  )
})

async function createProject() {
  const directory = await mkdtemp(path.join(tmpdir(), "pliantui-skills-"))
  projects.push(directory)
  return directory
}

describe("pliantui skills", () => {
  it("lists the skills that ship with the package", async () => {
    const { stdout, exitCode } = await runCli(await createProject(), [
      "skills",
      "list",
    ])

    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/^setup\n {2}Add Pliant to a Next\.js/m)
  })

  it("adds the skills from the built package to a project", async () => {
    const cwd = await createProject()
    await mkdir(path.join(cwd, ".claude"))

    const { stdout, exitCode } = await runCli(cwd, ["skills", "add"])

    expect(exitCode).toBe(0)
    expect(stdout).toContain("Added setup in .claude/skills/setup.")
    expect(
      await readFile(path.join(cwd, ".claude/skills/setup/SKILL.md"), "utf8")
    ).toMatch(/^---\nname: setup\n/)
  })
})
