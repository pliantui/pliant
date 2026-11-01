import { readFileSync } from "node:fs"
import path from "node:path"
import addFormats from "ajv-formats"
import Ajv from "ajv/dist/2020"
import { describe, expect, it } from "vitest"
import * as z from "zod"

import { readFixture, readOpFixtures, type Fixture } from "../test/fixtures"
import { addressSchema } from "./address"
import { expressionSchema } from "./expression"
import { filterSchema } from "./filter"
import { formatSchema } from "./format"
import { itemIdSchema } from "./identifier"
import { breakpointSchema } from "./layout"
import { manifestSchema } from "./manifest"
import { opSchema } from "./op"
import { overlaySchema } from "./overlay"
import { savedViewSchema } from "./saved-view"
import { sortSchema } from "./sort"
import { surfaceSchema } from "./surface"

const schemas = [
  {
    name: "op",
    schema: opSchema,
    fixtures: [...readOpFixtures().values()],
  },
  {
    name: "overlay",
    schema: overlaySchema,
    fixtures: [readFixture("overlay")],
  },
  {
    name: "saved-view",
    schema: savedViewSchema,
    fixtures: [readFixture("saved-view")],
  },
  {
    name: "manifest",
    schema: manifestSchema,
    fixtures: [readFixture("manifest")],
  },
] satisfies { name: string; schema: z.ZodType; fixtures: Fixture[] }[]

function schemaId(name: string) {
  return `https://pliantui.dev/schema/${name}.json`
}

const definitions = {
  address: addressSchema,
  breakpoint: breakpointSchema,
  expression: expressionSchema,
  filter: filterSchema,
  format: formatSchema,
  itemId: itemIdSchema,
  sort: sortSchema,
  surface: surfaceSchema,
}

for (const [id, definition] of Object.entries(definitions)) {
  z.globalRegistry.add(definition, { ...z.globalRegistry.get(definition), id })
}

// A shared definition narrowed in place becomes { $ref, minItems }, which is
// valid JSON Schema but fails Ajv's strictTypes lint.
const ajv = new Ajv({ strict: true, strictTypes: false })
addFormats(ajv)

function compilePublished(name: string) {
  const compiled = ajv.getSchema(schemaId(name))
  if (compiled) {
    return compiled
  }
  const published: unknown = JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, `../schema/${name}.json`),
      "utf8"
    )
  )
  return ajv.compile(z.record(z.string(), z.unknown()).parse(published))
}

describe.each(schemas)("$name JSON Schema", ({ name, schema, fixtures }) => {
  it("matches the published file", async () => {
    const { $schema, ...rest } = z.toJSONSchema(schema, { io: "input" })
    const jsonSchema = {
      $schema,
      $id: schemaId(name),
      ...rest,
    }
    await expect(
      `${JSON.stringify(jsonSchema, null, 2)}\n`
    ).toMatchFileSnapshot(`../schema/${name}.json`)
  })

  it("agrees with the Zod schema on every fixture", () => {
    const validate = compilePublished(name)
    for (const { valid, invalid } of fixtures) {
      for (const value of [...valid, ...invalid]) {
        expect(validate(value), JSON.stringify(value)).toBe(
          schema.safeParse(value).success
        )
      }
    }
  })

  it("leaves only cross-field rules to Zod", () => {
    const validate = compilePublished(name)
    for (const { crossField } of fixtures) {
      for (const { value } of crossField) {
        expect(validate(value), JSON.stringify(value)).toBe(true)
        expect(schema.safeParse(value).success).toBe(false)
      }
    }
  })
})
