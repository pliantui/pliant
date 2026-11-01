import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchemas } from "./op"
import { opCatalog } from "./op-catalog"

function argsOf(schema: z.core.$ZodType): string[][] {
  if (schema instanceof z.ZodObject) {
    return [
      Object.keys(schema.shape).filter(
        (key) => key !== "op" && key !== "target"
      ),
    ]
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return schema.options.flatMap(argsOf)
  }
  throw new TypeError("Unexpected op schema")
}

describe("opCatalog", () => {
  it.each(Object.entries(opSchemas))(
    "lists the arguments of %s, one list per shape",
    (name, schema) => {
      expect(
        Object.entries(opCatalog).find(([key]) => key === name)?.[1].args
      ).toEqual(argsOf(schema))
    }
  )
})
