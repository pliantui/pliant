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
    name: "manifest",
    schema: manifestSchema,
    fixtures: [readFixture("manifest")],
  },
] satisfies { name: string; schema: z.ZodType; fixtures: Fixture[] }[]

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

describe.each(schemas)("$name JSON Schema", ({ name, schema, fixtures }) => {
  const jsonSchema = z.toJSONSchema(schema, { io: "input" })
  const validate = ajv.compile(jsonSchema)

  it("matches the published file", async () => {
    await expect(
      `${JSON.stringify(jsonSchema, null, 2)}\n`
    ).toMatchFileSnapshot(`../schema/${name}.json`)
  })

  it("agrees with the Zod schema on every fixture", () => {
    for (const { valid, invalid } of fixtures) {
      for (const value of [...valid, ...invalid]) {
        expect(validate(value), JSON.stringify(value)).toBe(
          schema.safeParse(value).success
        )
      }
    }
  })

  it("leaves only cross-field rules to Zod", () => {
    for (const { crossField } of fixtures) {
      for (const { value } of crossField) {
        expect(validate(value), JSON.stringify(value)).toBe(true)
        expect(schema.safeParse(value).success).toBe(false)
      }
    }
  })
})
