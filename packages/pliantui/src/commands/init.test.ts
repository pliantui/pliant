import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { stripVTControlCharacters } from "node:util"
import prompts from "prompts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as runCommandModule from "../utils/run-command"
import { runCommand } from "../utils/run-command"
import { init } from "./init"

vi.mock("../utils/run-command", async (importOriginal) => ({
  ...(await importOriginal<typeof runCommandModule>()),
  runCommand: vi.fn(() => Promise.resolve()),
}))

class ExitError extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`)
  }
}

interface ProjectOptions {
  dependencies?: Record<string, string>
  appDirectory?: string | null
  shadcn?: boolean
  lockfile?: string | null
  packageManager?: string
  componentsAlias?: string
  installed?: string[]
  registries?: Record<string, unknown>
}

let root: string
let cwd: string
let output: string[]

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "pliantui-init-"))
  cwd = path.join(root, "app")
  await mkdir(cwd)
  output = []
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    output.push(stripVTControlCharacters(args.join(" ")))
  })
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitError(code)
  })
  setTerminal(true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(runCommand).mockClear()
  setTerminal(false)
  await rm(root, { recursive: true, force: true })
})

function setTerminal(isTTY: boolean) {
  Object.defineProperty(process.stdin, "isTTY", {
    value: isTTY,
    configurable: true,
  })
}

async function write(file: string, content: string) {
  await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
  await writeFile(path.join(cwd, file), content)
}

async function createProject({
  dependencies = { next: "16.0.0", react: "19.0.0" },
  appDirectory = "app",
  shadcn = true,
  lockfile = "pnpm-lock.yaml",
  packageManager,
  componentsAlias = "./*",
  installed = [],
  registries,
}: ProjectOptions = {}) {
  await write(
    "package.json",
    JSON.stringify({ name: "app", dependencies, packageManager })
  )
  if (lockfile) {
    await write(lockfile, "")
  }
  if (appDirectory) {
    await write(
      `${appDirectory}/layout.tsx`,
      "export default function Layout() { return null }\n"
    )
  }
  await write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { jsx: "preserve", paths: { "@/*": [componentsAlias] } },
    })
  )
  if (shadcn) {
    await write(
      "components.json",
      JSON.stringify({
        aliases: { components: "@/components", utils: "@/lib/utils" },
        registries,
      })
    )
  }
  for (const file of installed) {
    await write(file, "export {}\n")
  }
}

async function run(...args: string[]) {
  try {
    await init.parseAsync(["--cwd", cwd, ...args], { from: "user" })
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

function commands() {
  return vi
    .mocked(runCommand)
    .mock.calls.map(([command, args]) => [command, ...args].join(" "))
}

async function componentsJson(): Promise<unknown> {
  return JSON.parse(await readFile(path.join(cwd, "components.json"), "utf8"))
}

async function registries() {
  const config = await componentsJson()
  return typeof config === "object" && config !== null && "registries" in config
    ? config.registries
    : undefined
}

const pliantRegistry = { "@pliant": "https://pliantui.dev/r/{name}.json" }

async function snapshot(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  for (const entry of await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath, entry.name)
      files[path.relative(directory, file)] = await readFile(file, "utf8")
    }
  }
  return files
}

const addRegion = "shadcn@latest add @pliant/pliant-region --yes"

describe("pliantui init in a Next.js app with shadcn", () => {
  it.each([
    ["pnpm-lock.yaml", "pnpm add @pliantui/react", `pnpm dlx ${addRegion}`],
    ["package-lock.json", "npm install @pliantui/react", `npx ${addRegion}`],
    ["yarn.lock", "yarn add @pliantui/react", `npx ${addRegion}`],
    ["bun.lock", "bun add @pliantui/react", `bunx ${addRegion}`],
  ])(
    "installs with the package manager from %s",
    async (lockfile, install, add) => {
      await createProject({ lockfile })

      expect(await run("--yes")).toBe(0)

      expect(commands()).toEqual([install, add])
      expect(vi.mocked(runCommand).mock.calls.map((call) => call[2])).toEqual([
        cwd,
        cwd,
      ])
    }
  )

  it("uses npm when there is no lockfile", async () => {
    await createProject({ lockfile: null })

    await run("--yes")

    expect(commands()[0]).toBe("npm install @pliantui/react")
  })

  it("finds the lockfile in a parent folder", async () => {
    await createProject({ lockfile: null })
    await writeFile(path.join(root, "pnpm-lock.yaml"), "")

    await run("--yes")

    expect(commands()).toEqual([
      "pnpm add @pliantui/react",
      `pnpm dlx ${addRegion}`,
    ])
  })

  it.each([
    ["pnpm@9.15.0", "pnpm add @pliantui/react", `pnpm dlx ${addRegion}`],
    ["yarn@4.5.0+sha512.abc", "yarn add @pliantui/react", `npx ${addRegion}`],
    ["bun@1.2.0", "bun add @pliantui/react", `bunx ${addRegion}`],
    ["npm@10.0.0", "npm install @pliantui/react", `npx ${addRegion}`],
  ])(
    "uses the packageManager field %s when there is no lockfile",
    async (packageManager, install, add) => {
      await createProject({ lockfile: null, packageManager })

      await run("--yes")

      expect(commands()).toEqual([install, add])
    }
  )

  it("finds the packageManager field in a parent folder", async () => {
    await createProject({ lockfile: null })
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "pnpm@9.15.0" })
    )

    await run("--yes")

    expect(commands()[0]).toBe("pnpm add @pliantui/react")
  })

  it("prefers a lockfile over the packageManager field", async () => {
    await createProject({
      lockfile: "yarn.lock",
      packageManager: "pnpm@9.15.0",
    })

    await run("--yes")

    expect(commands()[0]).toBe("yarn add @pliantui/react")
  })

  it("ignores a packageManager field it doesn't know", async () => {
    await createProject({ lockfile: null, packageManager: "deno@2.0.0" })

    await run("--yes")

    expect(commands()[0]).toBe("npm install @pliantui/react")
  })

  it("works with the src/app folder", async () => {
    await createProject({
      appDirectory: "src/app",
      componentsAlias: "./src/*",
    })

    expect(await run("--yes")).toBe(0)

    expect(commands()).toHaveLength(2)
  })

  it("adds the @pliant registry to components.json", async () => {
    await createProject()

    await run("--yes")

    expect(await registries()).toEqual(pliantRegistry)
    expect(printed()).toContain("Add the @pliant registry to components.json.")
  })

  it("keeps the rest of components.json", async () => {
    await createProject({
      registries: { "@acme": "https://acme.dev/r/{name}.json" },
    })

    await run("--yes")

    expect(await componentsJson()).toEqual({
      aliases: { components: "@/components", utils: "@/lib/utils" },
      registries: {
        "@acme": "https://acme.dev/r/{name}.json",
        ...pliantRegistry,
      },
    })
  })

  it("installs from the registry given with --registry", async () => {
    await createProject()

    await run("--yes", "--registry", "https://registry.example.com/r/")

    expect(await registries()).toEqual({
      "@pliant": "https://registry.example.com/r/{name}.json",
    })
    expect(commands()[1]).toBe(`pnpm dlx ${addRegion}`)
  })

  it("keeps an @pliant registry that is already in components.json", async () => {
    const own = { "@pliant": "https://mirror.example.com/r/{name}.json" }
    await createProject({ registries: own })

    await run("--yes")

    expect(await registries()).toEqual(own)
    expect(commands()).toEqual([
      "pnpm add @pliantui/react",
      `pnpm dlx ${addRegion}`,
    ])
  })

  it("leaves components.json alone when --registry names the current entry", async () => {
    await createProject({ registries: pliantRegistry })
    const before = await componentsJson()

    await run("--yes", "--registry", "https://pliantui.dev/r")

    expect(await componentsJson()).toEqual(before)
    expect(printed()).not.toContain("Add the @pliant registry")
  })

  it("stops when the registries in components.json are malformed", async () => {
    await createProject({ registries: { "@pliant": 42 } })

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("The registries field in components.json")
    expect(commands()).toEqual([])
  })

  it("replaces an @pliant registry when --registry names another", async () => {
    await createProject({
      registries: {
        "@pliant": {
          url: "https://mirror.example.com/r/{name}.json",
          headers: { Authorization: "Bearer ${TOKEN}" },
        },
      },
    })

    await run("--yes", "--registry", "https://registry.example.com/r")

    expect(await registries()).toEqual({
      "@pliant": {
        url: "https://registry.example.com/r/{name}.json",
        headers: { Authorization: "Bearer ${TOKEN}" },
      },
    })
  })

  it.each([
    "pliantui.dev/r",
    "ftp://pliantui.dev/r",
    "file:///etc/passwd",
    "https://pliantui.dev/r?token=abc",
    "https://pliantui.dev/r#section",
    "https://user:secret@pliantui.dev/r",
    "https://pliantui.dev/r & calc",
    "https://pliantui.dev/r|calc",
    "https://pliantui.dev/r^calc",
    "https://pliantui.dev/%PATH%",
    'https://pliantui.dev/"r"',
    "https://pliantui.dev/r;calc",
    "https://pliantui.dev/$(calc)",
    "https://pliantui.dev/r%zz",
    "https://",
  ])("rejects the registry %s", async (registry) => {
    await createProject()

    expect(await run("--yes", "--registry", registry)).toBe(1)

    expect(printed()).toContain("The registry must be an http or https URL")
    expect(commands()).toEqual([])
  })

  it("accepts a registry with a port and percent-encoded characters", async () => {
    await createProject()

    await run("--yes", "--registry", "http://localhost:4000/my%20r")

    expect(await registries()).toEqual({
      "@pliant": "http://localhost:4000/my%20r/{name}.json",
    })
  })

  it("prints the next step and the docs link", async () => {
    await createProject()

    await run("--yes")

    const text = printed()
    expect(text).toContain('import { PliantRoot } from "@pliantui/react"')
    expect(text).toContain(
      'import { PliantPrePaint } from "@pliantui/react/pre-paint"'
    )
    expect(text).toContain("<PliantRoot surface=")
    expect(text).toContain("<PliantPrePaint surface=")
    expect(text).toContain("<PliantRegion")
    expect(text).toContain("route pattern")
    expect(text).toContain("https://pliantui.dev/docs")
  })

  it("changes no file but components.json", async () => {
    await createProject()
    const before = await snapshot(cwd)

    await run("--yes")

    const after = await snapshot(cwd)
    expect(Object.keys(after)).toEqual(Object.keys(before))
    for (const file of Object.keys(before)) {
      if (file !== "components.json") {
        expect(after[file]).toBe(before[file])
      }
    }
  })

  it("stops with a message when a command fails", async () => {
    await createProject()
    vi.mocked(runCommand).mockRejectedValueOnce(new Error("exited with code 1"))

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("Add @pliantui/react failed.")
    expect(commands()).toHaveLength(1)
    expect(printed()).not.toContain("<PliantRoot")
  })
})

describe("running init twice", () => {
  it("changes nothing when Pliant is already set up", async () => {
    await createProject({
      dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      installed: ["components/pliant/pliant-region.tsx"],
      registries: pliantRegistry,
    })

    expect(await run("--yes")).toBe(0)

    expect(commands()).toEqual([])
    expect(printed()).toContain("Pliant is already set up in this project.")
  })

  it("finds installed components through the components alias", async () => {
    await createProject({
      dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      appDirectory: "src/app",
      componentsAlias: "./src/*",
      installed: ["src/components/pliant/pliant-region.tsx"],
      registries: pliantRegistry,
    })

    await run("--yes")

    expect(commands()).toEqual([])
  })

  it("only adds the dependency when the components are there", async () => {
    await createProject({
      installed: ["components/pliant/pliant-region.tsx"],
      registries: pliantRegistry,
    })

    await run("--yes")

    expect(commands()).toEqual(["pnpm add @pliantui/react"])
  })

  it("only adds the components when the dependency is there", async () => {
    await createProject({
      dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
    })

    await run("--yes")

    expect(commands()).toEqual([`pnpm dlx ${addRegion}`])
  })

  it("only adds the registry when everything else is there", async () => {
    await createProject({
      dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      installed: ["components/pliant/pliant-region.tsx"],
    })

    await run("--yes")

    expect(commands()).toEqual([])
    expect(await registries()).toEqual(pliantRegistry)
  })

  it("counts a dependency in devDependencies", async () => {
    await createProject({
      installed: ["components/pliant/pliant-region.tsx"],
      registries: pliantRegistry,
    })
    await write(
      "package.json",
      JSON.stringify({
        devDependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      })
    )

    await run("--yes")

    expect(commands()).toEqual([])
  })
})

describe("pliantui init prompts", () => {
  it("asks before each command and runs the ones you accept", async () => {
    await createProject()
    prompts.inject([true, true, true])

    expect(await run()).toBe(0)

    expect(commands()).toEqual([
      "pnpm add @pliantui/react",
      "pnpm dlx shadcn@latest add @pliant/pliant-region",
    ])
    expect(await registries()).toEqual(pliantRegistry)
  })

  it("prints the exact command for each one you decline", async () => {
    await createProject()
    prompts.inject([false, true, true])

    await run()

    expect(commands()).toEqual([
      "pnpm dlx shadcn@latest add @pliant/pliant-region",
    ])
    expect(printed()).toContain(
      "Skipped. To do it yourself, run: pnpm add @pliantui/react"
    )
    expect(printed()).not.toContain("Pliant is ready.")
  })

  it("doesn't add components without the registry they come from", async () => {
    await createProject()
    prompts.inject([true, false])

    await run()

    expect(commands()).toEqual(["pnpm add @pliantui/react"])
    expect(await registries()).toBeUndefined()
    expect(printed()).toContain(
      'Skipped. To do it yourself, add "@pliant": "https://pliantui.dev/r/{name}.json" to registries in components.json.'
    )
    expect(printed()).toContain(
      "then run: pnpm dlx shadcn@latest add @pliant/pliant-region"
    )
    expect(printed()).not.toContain("Pliant is ready.")
  })

  it("stops without running anything when you cancel", async () => {
    await createProject()
    prompts.inject([new Error("cancelled")])

    expect(await run()).toBe(0)

    expect(commands()).toEqual([])
    expect(printed()).toContain("Cancelled.")
  })

  it("needs a terminal unless you pass --yes", async () => {
    await createProject()
    setTerminal(false)

    expect(await run()).toBe(1)

    expect(printed()).toContain("--yes")
    expect(commands()).toEqual([])
  })

  it("doesn't need a terminal when everything is set up", async () => {
    await createProject({
      dependencies: { next: "16.0.0", "@pliantui/react": "^0.1.0" },
      installed: ["components/pliant/pliant-region.jsx"],
      registries: pliantRegistry,
    })
    setTerminal(false)

    expect(await run()).toBe(0)

    expect(printed()).toContain("already set up")
  })
})

describe("pliantui init prerequisites", () => {
  it("asks for shadcn first when components.json is missing", async () => {
    await createProject({ shadcn: false })

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("No components.json found")
    expect(printed()).toContain("npx shadcn@latest init")
    expect(commands()).toEqual([])
  })

  it.each([
    ["Vite", { vite: "7.0.0", react: "19.0.0" }],
    ["React Router", { "react-router": "7.0.0" }],
    ["Astro", { astro: "5.0.0" }],
  ])("doesn't support %s", async (name, dependencies) => {
    await createProject({ dependencies, appDirectory: null })

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain(`${name} is not supported by pliantui init.`)
    expect(printed()).toContain(
      "pliantui init sets up Next.js App Router projects that use shadcn/ui."
    )
    expect(printed()).not.toContain("installation guide")
    expect(commands()).toEqual([])
  })

  it("doesn't support a project it can't identify", async () => {
    await createProject({ dependencies: {}, appDirectory: null })

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("not supported by pliantui init")
    expect(commands()).toEqual([])
  })

  it("doesn't support the Next.js Pages Router", async () => {
    await createProject({ appDirectory: null })
    await write("pages/index.tsx", "export default function Page() {}\n")

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain(
      "Next.js with the Pages Router is not supported by pliantui init."
    )
    expect(commands()).toEqual([])
  })

  it("reports the framework before the missing components.json", async () => {
    await createProject({
      dependencies: { vite: "7.0.0" },
      appDirectory: null,
      shadcn: false,
    })

    await run("--yes")

    expect(printed()).toContain("Vite is not supported")
    expect(printed()).not.toContain("components.json")
  })

  it("fails when there is no package.json", async () => {
    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("No package.json found")
  })

  it("fails when the directory doesn't exist", async () => {
    await rm(cwd, { recursive: true })

    expect(await run("--yes")).toBe(1)

    expect(printed()).toContain("does not exist")
  })
})
