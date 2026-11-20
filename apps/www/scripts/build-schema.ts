import { copyFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Copies the contract's JSON Schemas into `public/` at the path their `$id`
// names, so `https://pliantui.dev/schema/overlay.json` is a static file:
// `pnpm --filter www schema:build`.

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
    if (url.origin !== origin || url.search || url.hash) {
      throw new Error(`${name} has a $id outside ${origin}: ${id}`)
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
