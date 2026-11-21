import { randomUUID } from "node:crypto"
import { cp, mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execa } from "execa"

const require = createRequire(import.meta.url)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")

// Fixtures are copied inside this package, so their imports resolve to the
// type packages installed here.
const tempDirectory = path.join(root, "temp")

// Test files run in parallel, so each removes only the copies it made.
const created: string[] = []

export const cliPath = path.join(
  path.dirname(require.resolve("pliantui/package.json")),
  "dist/index.js"
)

export async function createFixtureDirectory(fixture: string) {
  const directory = path.join(tempDirectory, `${fixture}-${randomUUID()}`)
  await mkdir(tempDirectory, { recursive: true })
  await cp(path.join(root, "fixtures", fixture), directory, { recursive: true })
  created.push(directory)
  return directory
}

export async function removeFixtureDirectories() {
  await Promise.all(
    created
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
}

export async function runCli(cwd: string, args: string[]) {
  const result = await execa("node", [cliPath, ...args], {
    cwd,
    env: { FORCE_COLOR: "0", CI: "true" },
    reject: false,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode ?? 1,
  }
}
