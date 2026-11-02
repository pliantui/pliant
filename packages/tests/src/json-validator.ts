import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import addFormats from "ajv-formats"
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js"

type Json = Record<string, unknown>

export type Status = "valid" | "unknown" | "newer" | "invalid"

interface CatalogEntry {
  layers: string[]
  args: string[][]
}

const require = createRequire(import.meta.url)

function readSchemaFile(name: string): Json {
  const value: unknown = JSON.parse(
    readFileSync(
      require.resolve(`@pliantui/contract/schema/${name}.json`),
      "utf8"
    )
  )
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name}.json isn't an object`)
  }
  return Object.fromEntries(Object.entries(value))
}

const ajv = new Ajv2020({ strict: false })
addFormats(ajv)

const overlayJson = readSchemaFile("overlay")
const opJson = readSchemaFile("op")
const opId = String(opJson["$id"])
const validateOverlayJson = ajv.compile(overlayJson)
const validateOpJson = ajv.compile(opJson)

function definition(name: string): ValidateFunction {
  const validate = ajv.getSchema(`${opId}#/$defs/${name}`)
  if (!validate) {
    throw new TypeError(`op.json has no $defs/${name}`)
  }
  return validate
}

const validateSort = definition("sort")
const validateExpression = definition("expression")

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function catalogEntry(value: unknown): CatalogEntry {
  if (
    !isObject(value) ||
    !isStrings(value["layers"]) ||
    !Array.isArray(value["args"]) ||
    !value["args"].every(isStrings)
  ) {
    throw new TypeError("catalog.json has a malformed entry")
  }
  return { layers: value["layers"], args: value["args"] }
}

const catalogOps = readSchemaFile("catalog")["ops"]
const catalog = new Map(
  isObject(catalogOps)
    ? Object.entries(catalogOps).map(([name, entry]) => [
        name,
        catalogEntry(entry),
      ])
    : []
)

const opName = /^[a-z][A-Za-z0-9]*$/
const target = /^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/
const kebab = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*"
const slotTarget = new RegExp(`^${kebab}(?:/[a-z]+/[^/]+)*/slots/${kebab}$`)

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function values(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return [value, ...value.flatMap(values)]
  }
  if (isObject(value)) {
    return [value, ...Object.values(value).flatMap(values)]
  }
  return [value]
}

function countNodes(expression: unknown): number {
  if (isObject(expression) && Array.isArray(expression["args"])) {
    return (
      1 +
      expression["args"].reduce<number>((sum, arg) => sum + countNodes(arg), 0)
    )
  }
  return 1
}

function passesExtraRules(op: Json) {
  const to = op["to"]
  if (op["op"] === "move" && isObject(to) && "into" in to) {
    const from = String(op["target"])
    const into = String(to["into"])
    if (
      !slotTarget.test(from) ||
      from.split("/")[0]?.endsWith("[]") ||
      into === from ||
      into.startsWith(`${from}/`)
    ) {
      return false
    }
  }
  for (const value of values(op)) {
    if (Array.isArray(value) && validateSort(value)) {
      const fields: unknown[] = value.map((entry: unknown) =>
        isObject(entry) ? entry["field"] : undefined
      )
      if (new Set(fields).size !== fields.length) {
        return false
      }
    }
    if (
      isObject(value) &&
      validateExpression(value) &&
      countNodes(value) > 128
    ) {
      return false
    }
  }
  return true
}

function isValid(
  op: Json,
  entry: CatalogEntry,
  layer: string,
  surface: string
) {
  return (
    validateOpJson(op) &&
    entry.layers.includes(layer) &&
    (op["target"] === "@app") === (surface === "@app") &&
    passesExtraRules(op)
  )
}

export function opStatus(op: unknown, layer: string, surface: string): Status {
  if (
    !isObject(op) ||
    typeof op["op"] !== "string" ||
    op["op"].length > 64 ||
    !opName.test(op["op"]) ||
    typeof op["target"] !== "string" ||
    op["target"].length > 256 ||
    !target.test(op["target"])
  ) {
    return "invalid"
  }
  const entry = catalog.get(op["op"])
  if (!entry) {
    return "unknown"
  }
  if (isValid(op, entry, layer, surface)) {
    return "valid"
  }
  const known = new Set(["op", "target", ...entry.args.flat()])
  const stripped = Object.fromEntries(
    Object.entries(op).filter(([key]) => known.has(key))
  )
  return Object.keys(op).length > Object.keys(stripped).length &&
    isValid(stripped, entry, layer, surface)
    ? "newer"
    : "invalid"
}

export function isOverlayValid(overlay: unknown) {
  if (!validateOverlayJson(overlay) || !isObject(overlay)) {
    return false
  }
  const { explain, ops } = overlay
  return (
    !Array.isArray(explain) ||
    !Array.isArray(ops) ||
    explain.length === ops.length
  )
}
