import Ajv from "ajv/dist/2020"
import { describe, expect, it } from "vitest"
import * as z from "zod"

import { readFixture, readOpFixtures, type Fixture } from "../test/fixtures"
import { manifestSchema } from "./manifest"
import { opSchema } from "./op"
import { overlaySchema } from "./overlay"

const opFixtures = [...readOpFixtures().values()]

const schemas = [
  {
    name: "op",
    schema: opSchema,
    fixtures: opFixtures,
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

const ajv = new Ajv({ strict: true, validateFormats: false })

describe.each(schemas)("$name JSON Schema", ({ name, schema, fixtures }) => {
  const jsonSchema = z.toJSONSchema(schema, { io: "input" })

  it("matches the published file", async () => {
    await expect(
      `${JSON.stringify(jsonSchema, null, 2)}\n`
    ).toMatchFileSnapshot(`../schema/${name}.json`)
  })

  it("agrees with the Zod schema on every fixture", () => {
    const validate = ajv.compile(jsonSchema)
    for (const { valid, invalid } of fixtures) {
      for (const value of [...valid, ...invalid]) {
        expect(validate(value), JSON.stringify(value)).toBe(
          schema.safeParse(value).success
        )
      }
    }
  })
})
