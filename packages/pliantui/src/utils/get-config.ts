import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { ts } from "ts-morph"
import * as z from "zod"

import { highlighter } from "./highlighter"

const componentsJsonSchema = z.object({
  aliases: z.object({
    components: z.string(),
    utils: z.string(),
    ui: z.string().optional(),
    lib: z.string().optional(),
  }),
})

export interface Config {
  tsConfigFilePath: string
  resolvedPaths: {
    cwd: string
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
  const { aliases } = componentsJsonSchema.parse(raw)

  const tsConfigFilePath = ["tsconfig.json", "jsconfig.json"]
    .map((file) => path.join(cwd, file))
    .find((file) => existsSync(file))
  if (!tsConfigFilePath) {
    throw new Error(
      `No ${highlighter.info("tsconfig.json")} or ${highlighter.info("jsconfig.json")} found in ${highlighter.info(cwd)}.`
    )
  }

  const resolve = createAliasResolver(tsConfigFilePath)
  const components = resolve(aliases.components)
  const utils = resolve(aliases.utils)
  const ui = aliases.ui
    ? resolve(aliases.ui)
    : components && path.join(components, "ui")
  const lib = aliases.lib ? resolve(aliases.lib) : utils && path.dirname(utils)

  const missing = Object.entries({ components, utils, ui, lib })
    .filter(([, resolved]) => !resolved)
    .map(([key]) => key)
  if (!ui || !lib || missing.length > 0) {
    throw new Error(
      [
        `Could not resolve the following aliases in ${highlighter.info(cwd)}: ${highlighter.info(missing.join(", "))}.`,
        `Configure path aliases in ${highlighter.info(path.basename(tsConfigFilePath))} and try again.`,
      ].join("\n")
    )
  }

  return { tsConfigFilePath, resolvedPaths: { cwd, ui, lib } }
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

  return (alias: string) => {
    for (const [pattern, targets] of Object.entries(paths)) {
      const target = targets[0]
      if (target === undefined) {
        continue
      }
      const star = pattern.indexOf("*")
      if (star === -1) {
        if (pattern === alias) {
          return path.resolve(base, target)
        }
        continue
      }
      const prefix = pattern.slice(0, star)
      const suffix = pattern.slice(star + 1)
      if (
        alias.length >= prefix.length + suffix.length &&
        alias.startsWith(prefix) &&
        alias.endsWith(suffix)
      ) {
        const matched = alias.slice(prefix.length, alias.length - suffix.length)
        return path.resolve(base, target.replace("*", matched))
      }
    }
    return null
  }
}
