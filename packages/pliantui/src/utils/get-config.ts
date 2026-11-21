import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { ts } from "ts-morph"
import * as z from "zod"

import { highlighter } from "./highlighter"

const componentsJsonSchema = z.object({
  tsx: z.boolean().default(true),
  aliases: z.object({
    components: z.string(),
    utils: z.string(),
    ui: z.string().optional(),
    lib: z.string().optional(),
  }),
})

interface Config {
  tsx: boolean
  tsConfigFilePath: string
  resolvedPaths: {
    cwd: string
    components: string | null
    ui: string
    lib: string
  }
}

export async function getConfig(cwd: string): Promise<Config | null> {
  const componentsJsonPath = path.join(cwd, "components.json")
  if (!existsSync(componentsJsonPath)) {
    return null
  }

  let raw: unknown
  try {
    raw = JSON.parse(await readFile(componentsJsonPath, "utf8"))
  } catch {
    throw new Error(
      `Could not read ${highlighter.info(componentsJsonPath)}. Check that it is valid JSON.`
    )
  }
  const parsed = componentsJsonSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      [
        `Invalid configuration found in ${highlighter.info(componentsJsonPath)}:`,
        ...parsed.error.issues.map(
          (issue) => `- ${issue.path.join(".")}: ${issue.message}`
        ),
      ].join("\n")
    )
  }
  const { tsx, aliases } = parsed.data

  const tsConfigFilePath = ["tsconfig.json", "jsconfig.json"]
    .map((file) => path.join(cwd, file))
    .find((file) => existsSync(file))
  if (!tsConfigFilePath) {
    throw new Error(
      `No ${highlighter.info("tsconfig.json")} or ${highlighter.info("jsconfig.json")} found in ${highlighter.info(cwd)}.`
    )
  }

  const resolve = createAliasResolver(tsConfigFilePath)
  const resolveUi = () =>
    aliases.ui
      ? resolve(aliases.ui)
      : mapResolved(resolve(aliases.components), (components) =>
          path.join(components, "ui")
        )
  const resolveLib = () =>
    aliases.lib
      ? resolve(aliases.lib)
      : mapResolved(resolve(aliases.utils), (utils) => path.dirname(utils))
  const ui = resolveUi()
  const lib = resolveLib()

  if (!ui || !lib) {
    const missing = [
      ...(ui ? [] : [aliases.ui ? "ui" : "components"]),
      ...(lib ? [] : [aliases.lib ? "lib" : "utils"]),
    ]
    throw new Error(
      [
        `Could not resolve the following aliases in ${highlighter.info(cwd)}: ${highlighter.info(missing.join(", "))}.`,
        `Configure path aliases in ${highlighter.info(path.basename(tsConfigFilePath))} and try again.`,
      ].join("\n")
    )
  }

  return {
    tsx,
    tsConfigFilePath,
    resolvedPaths: { cwd, components: resolve(aliases.components), ui, lib },
  }
}

function mapResolved(value: string | null, map: (value: string) => string) {
  return value === null ? null : map(value)
}

function createAliasResolver(tsConfigFilePath: string) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    tsConfigFilePath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        )
      },
    }
  )
  const options = parsed?.options ?? {}
  const paths = options.paths ?? {}
  const pathsBase = options["pathsBasePath"]
  const base =
    // TypeScript 6 deprecates baseUrl, but projects on TypeScript 5 still
    // resolve their paths against it.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    options.baseUrl ??
    (typeof pathsBase === "string" ? pathsBase : path.dirname(tsConfigFilePath))

  // Like TypeScript, an exact pattern wins, then the longest prefix.
  const patterns = Object.entries(paths)
    .map(([pattern, targets]) => {
      const star = pattern.indexOf("*")
      return {
        prefix: star === -1 ? pattern : pattern.slice(0, star),
        suffix: star === -1 ? "" : pattern.slice(star + 1),
        exact: star === -1,
        targets,
      }
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) || b.prefix.length - a.prefix.length
    )

  return (alias: string) => {
    // Each target is tried in turn, as TypeScript does.
    const pick = (candidates: string[]) =>
      candidates.find((candidate) => existsSync(candidate)) ??
      candidates[0] ??
      null
    for (const { prefix, suffix, exact, targets } of patterns) {
      if (exact) {
        if (prefix === alias) {
          return pick(targets.map((target) => path.resolve(base, target)))
        }
        continue
      }
      if (
        alias.length >= prefix.length + suffix.length &&
        alias.startsWith(prefix) &&
        alias.endsWith(suffix)
      ) {
        const matched = alias.slice(prefix.length, alias.length - suffix.length)
        return pick(
          targets.map((target) =>
            path.resolve(base, target.replace("*", matched))
          )
        )
      }
    }
    return null
  }
}
