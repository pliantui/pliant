import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import * as z from "zod"

export const namespace = "@pliant"

const componentsJsonSchema = z.looseObject({
  registries: z
    .record(
      z.string(),
      z.union([z.string(), z.looseObject({ url: z.string() })])
    )
    .optional(),
})

export function registryTemplate(registry: string) {
  return `${registry}/{name}.json`
}

export async function readPliantRegistry(cwd: string) {
  const config = await readComponentsJson(cwd)
  const entry = config.registries?.[namespace]
  return typeof entry === "object" ? entry.url : entry
}

// shadcn reads the namespace from the same file, so `shadcn add
// @pliant/<name>` resolves against this URL. An entry written as an object
// keeps its headers and params.
export async function writePliantRegistry(cwd: string, template: string) {
  const config = await readComponentsJson(cwd)
  const registries = config.registries ?? {}
  const entry = registries[namespace]
  config.registries = {
    ...registries,
    [namespace]:
      typeof entry === "object" ? { ...entry, url: template } : template,
  }
  await writeFile(
    path.join(cwd, "components.json"),
    `${JSON.stringify(config, null, 2)}\n`
  )
}

async function readComponentsJson(cwd: string) {
  const raw: unknown = JSON.parse(
    await readFile(path.join(cwd, "components.json"), "utf8")
  )
  const parsed = componentsJsonSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `The registries field in components.json must map each namespace to a URL or to an object with a url.`
    )
  }
  return parsed.data
}
