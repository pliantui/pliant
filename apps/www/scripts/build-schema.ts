import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The schemas are static files under `public/`, so they need no route handler
// and are served as plain assets wherever the site runs.

const origin = "https://pliantui.dev"

export const contractSchemaDirectory = dirname(
  fileURLToPath(import.meta.resolve("@pliantui/contract/schema/overlay.json"))
)

function readId(file: string) {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"))
  if (typeof value !== "object" || value === null || !("$id" in value)) {
    return undefined
  }
  const id = value.$id
  if (typeof id !== "string") {
    throw new TypeError(`${file} has a $id that isn't a string`)
  }
  return id
}

export function buildSchemas(outputDirectory: string) {
  rmSync(join(outputDirectory, "schema"), { recursive: true, force: true })
  const ids: string[] = []
  for (const name of readdirSync(contractSchemaDirectory).sort()) {
    if (!name.endsWith(".json")) {
      continue
    }
    const file = join(contractSchemaDirectory, name)
    const id = readId(file)
    if (id === undefined) {
      continue
    }
    const url = new URL(id)
    if (
      url.origin !== origin ||
      !url.pathname.startsWith("/schema/") ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${name} has a $id outside ${origin}/schema/: ${id}`)
    }
    if (ids.includes(id)) {
      throw new Error(`${name} repeats the $id ${id}`)
    }
    const target = join(outputDirectory, url.pathname)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(file, target)
    ids.push(id)
  }
  return ids
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputDirectory = resolve(import.meta.dirname, "../public")
  for (const id of buildSchemas(outputDirectory)) {
    console.log(id)
  }
}
