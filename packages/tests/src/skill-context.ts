import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

import { runCli } from "./helpers"

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.join(here, "../../..")
const docsDirectory = path.join(repository, "apps/www/content/docs")
const registryDirectory = path.join(repository, "apps/www/registry/pliant")

const packageNames = [
  "@pliantui/contract",
  "@pliantui/core",
  "@pliantui/react",
  "@pliantui/server",
]

export const skillsDirectory = path.join(
  path.dirname(require.resolve("pliantui/package.json")),
  "skills"
)

interface CommandInfo {
  commands: string[]
  options: string[]
}

export interface SkillContext {
  /** The names each `@pliantui/*` entry point and registry file exports. */
  exportsOf: (specifier: string) => ReadonlySet<string> | undefined
  allExports: ReadonlySet<string>
  /** Routes such as `/docs/cli`, with the anchors of their headings. */
  docs: ReadonlyMap<string, ReadonlySet<string>>
  registryItems: ReadonlySet<string>
  /** The commands and options `pliantui <path> --help` lists. */
  commandInfo: (path: readonly string[]) => CommandInfo | undefined
}

const compilerOptions: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2023,
  jsx: ts.JsxEmit.Preserve,
  skipLibCheck: true,
  noEmit: true,
  types: [],
}

function slugify(heading: string) {
  return heading
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ +/g, "-")
}

async function readDocs() {
  const docs = new Map<string, Set<string>>()
  const files = await readdir(docsDirectory, { recursive: true })
  for (const file of files.filter((name) => name.endsWith(".mdx"))) {
    const route = path
      .join("/docs", file.replace(/\.mdx$/, "").replace(/(^|\/)?index$/, ""))
      .replace(/\/$/, "")
    const text = await readFile(path.join(docsDirectory, file), "utf8")
    const anchors = new Set<string>()
    let fenced = false
    for (const line of text.split("\n")) {
      if (line.startsWith("```")) {
        fenced = !fenced
      }
      const heading = fenced ? null : /^#{2,6}\s+(.+)$/.exec(line)
      if (heading?.[1]) {
        anchors.add(slugify(heading[1]))
      }
    }
    docs.set(route, anchors)
  }
  return docs
}

function sections(help: string) {
  const result = new Map<string, string[]>()
  let current: string[] | undefined
  for (const line of help.split("\n")) {
    const title = /^([A-Z][a-z]+):/.exec(line)
    if (title?.[1]) {
      current = []
      result.set(title[1], current)
    } else if (current && line.startsWith("  ")) {
      current.push(line)
    }
  }
  return result
}

async function readCommandInfo(
  commandPath: readonly string[]
): Promise<CommandInfo | undefined> {
  const { stdout, exitCode } = await runCli(repository, [
    ...commandPath,
    "--help",
  ])
  if (exitCode !== 0) {
    return undefined
  }
  const found = sections(stdout)
  const names = (lines: string[] | undefined) =>
    (lines ?? [])
      .filter((line) => /^ {2}\S/.test(line))
      .map((line) => line.trim().split(/ {2,}/)[0] ?? "")
  return {
    commands: names(found.get("Commands"))
      .map((entry) => entry.split(/[\s|]/)[0] ?? "")
      .filter((name) => name !== "help"),
    options: names(found.get("Options")).flatMap(
      (entry) => entry.match(/--?[\w-]+/g) ?? []
    ),
  }
}

export async function createSkillContext(): Promise<SkillContext> {
  const registryFiles = (await readdir(registryDirectory))
    .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
    .map((file) => path.join(registryDirectory, file))
  const entries = new Map<string, string>()
  for (const name of packageNames) {
    const manifest = JSON.parse(
      await readFile(
        path.join(
          repository,
          "packages",
          name.slice("@pliantui/".length),
          "package.json"
        ),
        "utf8"
      )
    ) as { exports: Record<string, unknown> }
    for (const [key, target] of Object.entries(manifest.exports)) {
      if (
        typeof target !== "object" ||
        target === null ||
        !("types" in target)
      ) {
        continue
      }
      const specifier = `${name}${key.slice(1)}`
      const resolved = ts.resolveModuleName(
        specifier,
        path.join(here, "skill-context.ts"),
        compilerOptions,
        ts.sys
      ).resolvedModule?.resolvedFileName
      if (!resolved || !existsSync(resolved)) {
        throw new Error(`${specifier} has no types. Build the packages first.`)
      }
      entries.set(specifier, resolved)
    }
  }
  for (const file of registryFiles) {
    entries.set(`registry:${path.basename(file).replace(/\.tsx?$/, "")}`, file)
  }

  const program = ts.createProgram([...entries.values()], compilerOptions)
  const checker = program.getTypeChecker()
  const exported = new Map<string, Set<string>>()
  for (const [specifier, file] of entries) {
    const source = program.getSourceFile(file)
    const symbol = source && checker.getSymbolAtLocation(source)
    exported.set(
      specifier,
      new Set(
        symbol
          ? checker.getExportsOfModule(symbol).map((item) => item.getName())
          : []
      )
    )
  }

  const registry = JSON.parse(
    await readFile(path.join(repository, "apps/www/registry.json"), "utf8")
  ) as { items: { name: string }[] }
  const info = new Map<string, CommandInfo | undefined>()
  const queue: string[][] = [[]]
  for (let next = queue.shift(); next; next = queue.shift()) {
    const found = await readCommandInfo(next)
    info.set(next.join(" "), found)
    for (const command of found?.commands ?? []) {
      queue.push([...next, command])
    }
  }

  return {
    exportsOf: (specifier) => exported.get(specifier),
    allExports: new Set([...exported.values()].flatMap((names) => [...names])),
    docs: await readDocs(),
    registryItems: new Set(registry.items.map((item) => item.name)),
    commandInfo: (commandPath) => info.get(commandPath.join(" ")),
  }
}
