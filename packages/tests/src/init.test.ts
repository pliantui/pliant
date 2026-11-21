import { randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"

import { runCli, tempDirectory } from "./helpers"

const projects: string[] = []

afterAll(async () => {
  await Promise.all(
    projects.map((project) => rm(project, { recursive: true, force: true }))
  )
})

async function createProject(files: Record<string, string>) {
  const directory = path.join(tempDirectory, `init-${randomUUID()}`)
  projects.push(directory)
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true })
    await writeFile(path.join(directory, file), content)
  }
  return directory
}

const shadcnFiles = {
  "components.json": JSON.stringify({
    aliases: { components: "@/components", utils: "@/lib/utils" },
  }),
  "tsconfig.json": JSON.stringify({
    compilerOptions: { paths: { "@/*": ["./*"] } },
  }),
}

describe("pliantui init", () => {
  it("says so when the project is already set up", async () => {
    const cwd = await createProject({
      ...shadcnFiles,
      "package.json": JSON.stringify({
        dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      }),
      "app/layout.tsx": "export default function Layout() { return null }\n",
      "components/pliant/pliant-region.tsx": "export {}\n",
    })

    const { stdout, exitCode } = await runCli(cwd, ["init", "--yes"])

    expect(exitCode).toBe(0)
    expect(stdout).toContain("Pliant is already set up in this project.")
  })

  it("stops in a project that isn't Next.js", async () => {
    const cwd = await createProject({
      ...shadcnFiles,
      "package.json": JSON.stringify({ dependencies: { vite: "7.0.0" } }),
    })

    const { stdout, exitCode } = await runCli(cwd, ["init", "--yes"])

    expect(exitCode).toBe(1)
    expect(stdout).toContain("Vite is not supported by pliantui init.")
    expect(stdout).toContain("https://pliantui.dev/docs")
  })

  it("asks for shadcn first when components.json is missing", async () => {
    const cwd = await createProject({
      "package.json": JSON.stringify({ dependencies: { next: "16.0.0" } }),
      "app/layout.tsx": "export default function Layout() { return null }\n",
    })

    const { stdout, exitCode } = await runCli(cwd, ["init", "--yes"])

    expect(exitCode).toBe(1)
    expect(stdout).toContain("npx shadcn@latest init")
  })
})
