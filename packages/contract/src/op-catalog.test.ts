import { describe, expect, it } from "vitest"
import * as z from "zod"

import { opSchemas } from "./op"
import { opCatalog } from "./op-catalog"

function argsOf(schema: z.core.$ZodType): string[][] {
  if (schema instanceof z.ZodObject) {
    return [
      Object.keys(schema.shape)
        .filter((key) => key !== "op" && key !== "target")
        .sort(),
    ]
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return schema.options.flatMap(argsOf)
  }
  throw new TypeError("Unexpected op schema")
}

function sorted(lists: readonly (readonly string[])[]) {
  return lists
    .map((keys) => [...keys].sort())
    .sort((a, b) => a.join().localeCompare(b.join()))
}

describe("opCatalog", () => {
  it("lists every op's arguments, one list per shape", () => {
    expect(
      Object.fromEntries(
        Object.entries(opCatalog).map(([name, { args }]) => [
          name,
          sorted(args),
        ])
      )
    ).toEqual(
      Object.fromEntries(
        Object.entries(opSchemas).map(([name, schema]) => [
          name,
          sorted(argsOf(schema)),
        ])
      )
    )
  })
})
