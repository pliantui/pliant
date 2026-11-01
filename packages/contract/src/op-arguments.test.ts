import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchemas } from "./op"
import { opArguments } from "./op-arguments"
import { opCatalog } from "./op-catalog"

function shapesOf(schema: z.core.$ZodType): string[][] {
  if (schema instanceof z.ZodObject) {
    return [
      Object.keys(schema.shape).filter(
        (key) => key !== "op" && key !== "target"
      ),
    ]
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return schema.options.flatMap(shapesOf)
  }
  throw new TypeError("Unexpected op schema")
}

describe("opArguments", () => {
  it("lists every op in the catalog", () => {
    expect(Object.keys(opArguments).sort()).toEqual(
      Object.keys(opCatalog).sort()
    )
  })

  it.each(Object.entries(opSchemas))(
    "matches the arguments of %s, one list per shape",
    (name, schema) => {
      const [, args] =
        Object.entries(opArguments).find(([key]) => key === name) ?? []
      expect(args).toEqual(shapesOf(schema))
    }
  )
})
