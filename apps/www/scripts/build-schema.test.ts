import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vitest"

import { buildSchemas, contractSchemaDirectory } from "./build-schema"

let outputDirectory: string

beforeEach(() => {
  outputDirectory = mkdtempSync(join(tmpdir(), "pliant-schema-"))
})

afterEach(() => {
  rmSync(outputDirectory, { recursive: true, force: true })
})

function collectIds(value: unknown, ids: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectIds(item, ids)
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$id" && typeof item === "string") {
        ids.push(item)
      }
      collectIds(item, ids)
    }
  }
  return ids
}

function contractIds() {
  const ids: string[] = []
  for (const name of readdirSync(contractSchemaDirectory)) {
    if (name.endsWith(".json")) {
      const file = join(contractSchemaDirectory, name)
      collectIds(JSON.parse(readFileSync(file, "utf8")), ids)
    }
  }
  return ids
}

it("finds the contract's schemas", () => {
  expect(contractIds()).toContain("https://pliantui.dev/schema/overlay.json")
})

it("writes every contract $id to the file its URL names", () => {
  const built = buildSchemas(outputDirectory)
  const ids = contractIds()
  expect(built.toSorted()).toEqual(ids.toSorted())
  for (const id of ids) {
    const file = join(outputDirectory, new URL(id).pathname)
    const schema: unknown = JSON.parse(readFileSync(file, "utf8"))
    expect(schema, id).toMatchObject({ $id: id })
  }
})

it("removes schemas from an earlier build", () => {
  const stale = join(outputDirectory, "schema/removed.json")
  mkdirSync(dirname(stale), { recursive: true })
  writeFileSync(stale, "{}")
  buildSchemas(outputDirectory)
  expect(existsSync(stale)).toBe(false)
})
