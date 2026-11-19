import { describe, expect, it } from "vitest"
import * as z from "zod"

import { readOpFixtures } from "../test/fixtures"
import { opSchemas } from "./op"
import { opCatalog } from "./op-catalog"

// setDefault is one object refined into two shapes: with and without `prop`.
const refinedShapes: Record<string, string[][]> = {
  setDefault: [["value"], ["prop", "value"]],
}

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
          sorted(refinedShapes[name] ?? argsOf(schema)),
        ])
      )
    )
  })

  it("lists one capability and one appliesTo per shape when they differ", () => {
    for (const { capability, appliesTo, args } of Object.values(opCatalog)) {
      if (Array.isArray(capability)) {
        expect(capability).toHaveLength(args.length)
      }
      if (Array.isArray(appliesTo)) {
        expect(appliesTo).toHaveLength(args.length)
      }
    }
    expect([...new Set(refinedShapes["setDefault"]?.flat())].sort()).toEqual(
      argsOf(opSchemas.setDefault).flat().sort()
    )
    expect(opCatalog.setDefault).toMatchObject({
      capability: ["form", "defaults"],
      appliesTo: ["parent", "target"],
      args: [["value"], ["prop", "value"]],
    })
  })

  it("picks a list-form op's shape as the first args list with all its keys", () => {
    const shapeOf = (args: readonly (readonly string[])[], op: object) => {
      const keys = Object.keys(op).filter(
        (key) => key !== "op" && key !== "target"
      )
      return args.findIndex((list) => keys.every((key) => list.includes(key)))
    }
    const fixtures = readOpFixtures()
    for (const [name, { capability, args }] of Object.entries(opCatalog)) {
      if (!Array.isArray(capability)) {
        continue
      }
      for (const [index, list] of args.entries()) {
        expect(list.length).toBeGreaterThanOrEqual(args[index - 1]?.length ?? 0)
      }
      for (const op of fixtures.get(name)?.valid ?? []) {
        expect(shapeOf(args, z.object({}).loose().parse(op))).not.toBe(-1)
      }
    }
    const { args } = opCatalog.setDefault
    expect(
      shapeOf(args, { op: "setDefault", target: "f/fields/a", value: null })
    ).toBe(0)
    expect(
      shapeOf(args, {
        op: "setDefault",
        target: "tabs",
        prop: "defaultValue",
        value: "a",
      })
    ).toBe(1)
  })

  it("matches the published file", async () => {
    await expect(
      `${JSON.stringify(
        {
          contract: 1,
          ops: Object.fromEntries(
            Object.entries(opCatalog).map(
              ([name, { capability, layers, args }]) => [
                name,
                { capability, layers, args },
              ]
            )
          ),
        },
        null,
        2
      )}\n`
    ).toMatchFileSnapshot("../schema/catalog.json")
  })
})
