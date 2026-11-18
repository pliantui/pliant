import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import addFormats from "ajv-formats"
import Ajv from "ajv/dist/2020"

type Json = Record<string, unknown>

export type Status = "valid" | "unknown" | "newer" | "invalid"

interface CatalogEntry {
  layers: string[]
  args: string[][]
}

const require = createRequire(import.meta.url)

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function readSchemaFile(name: string): Json {
  const value: unknown = JSON.parse(
    readFileSync(
      require.resolve(`@pliantui/contract/schema/${name}.json`),
      "utf8"
    )
  )
  if (!isObject(value)) {
    throw new TypeError(`${name}.json isn't an object`)
  }
  return value
}

// A shared definition narrowed in place becomes { $ref, minItems }, which is
// valid JSON Schema but fails Ajv's strictTypes lint.
const ajv = new Ajv({ strict: true, strictTypes: false })
addFormats(ajv)

const opJson = readSchemaFile("op")
const opId = typeof opJson["$id"] === "string" ? opJson["$id"] : ""
if (opId === "") {
  throw new TypeError("op.json has no $id")
}
const validateOverlayJson = ajv.compile(readSchemaFile("overlay"))
const validateSavedViewJson = ajv.compile(readSchemaFile("saved-view"))
const validateManifestJson = ajv.compile(readSchemaFile("manifest"))
const validateOpJson = ajv.compile(opJson)

function definition(name: string) {
  const validate = ajv.getSchema(`${opId}#/$defs/${name}`)
  if (!validate) {
    throw new TypeError(`op.json has no $defs/${name}`)
  }
  return validate
}

const validateSort = definition("sort")
const validateExpression = definition("expression")

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
if (!isObject(catalogOps)) {
  throw new TypeError("catalog.json has no ops")
}
const catalog = new Map(
  Object.entries(catalogOps).map(([name, entry]) => [name, catalogEntry(entry)])
)

const opName = /^[a-z][A-Za-z0-9]*$/
const target = /^(?:[a-z][A-Za-z0-9_\-[\]/]*|@[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/
const slotTarget = /\/slots\/[^/]+$/

const reservedKeys = new Set(["__proto__", "constructor", "prototype"])

function hasReservedKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasReservedKey)
  }
  if (isObject(value)) {
    return Object.entries(value).some(
      ([key, child]) => reservedKeys.has(key) || hasReservedKey(child)
    )
  }
  return false
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
      expression["args"].reduce<number>(
        (sum, arg: unknown) => sum + countNodes(arg),
        0
      )
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
  return isValid(stripped, entry, layer, surface) ? "newer" : "invalid"
}

function hasMatchingExplain(overlay: Json) {
  const { explain, ops } = overlay
  return (
    !Array.isArray(explain) ||
    !Array.isArray(ops) ||
    explain.length === ops.length
  )
}

export function isOverlayValid(overlay: unknown) {
  return (
    !hasReservedKey(overlay) &&
    validateOverlayJson(overlay) &&
    isObject(overlay) &&
    hasMatchingExplain(overlay)
  )
}

export function opStatuses(overlay: unknown): Status[] {
  if (
    !isOverlayValid(overlay) ||
    !isObject(overlay) ||
    !Array.isArray(overlay["ops"])
  ) {
    return []
  }
  const layer = String(overlay["layer"])
  const surface = String(overlay["surface"])
  return overlay["ops"].map((op: unknown) => opStatus(op, layer, surface))
}

export function isImportValid(overlay: unknown) {
  return (
    isOverlayValid(overlay) &&
    opStatuses(overlay).every((status) => status === "valid")
  )
}

export function isSavedViewValid(view: unknown) {
  if (hasReservedKey(view) || !validateSavedViewJson(view) || !isObject(view)) {
    return false
  }
  const overlays: unknown[] = Array.isArray(view["overlays"])
    ? view["overlays"]
    : []
  const ids = new Set<unknown>()
  const [first] = overlays
  const scopeOf = (overlay: unknown) =>
    isObject(overlay) && isObject(overlay["scope"])
      ? [overlay["scope"]["org"], overlay["scope"]["team"]]
      : [undefined, undefined]
  for (const overlay of overlays) {
    if (
      !isObject(overlay) ||
      !hasMatchingExplain(overlay) ||
      overlay["surface"] !== view["surface"] ||
      overlay["layer"] !== view["layer"] ||
      scopeOf(overlay).join("\u0000") !== scopeOf(first).join("\u0000") ||
      ids.has(overlay["id"])
    ) {
      return false
    }
    ids.add(overlay["id"])
  }
  return true
}

export function isManifestValid(manifest: unknown) {
  if (
    hasReservedKey(manifest) ||
    !validateManifestJson(manifest) ||
    !isObject(manifest)
  ) {
    return false
  }
  const capabilities = manifest["capabilities"]
  const props = isObject(capabilities) ? capabilities["props"] : undefined
  return Object.values(isObject(props) ? props : {}).every((prop: unknown) => {
    if (!isObject(prop) || !isStrings(prop["values"])) {
      return false
    }
    const allowed = new Set(prop["values"])
    const semantic = isStrings(prop["semantic"]) ? prop["semantic"] : []
    return (
      (prop["default"] === undefined ||
        (typeof prop["default"] === "string" &&
          allowed.has(prop["default"]))) &&
      semantic.every((value) => allowed.has(value))
    )
  })
}
