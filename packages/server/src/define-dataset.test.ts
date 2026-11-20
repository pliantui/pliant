import { describe, expect, expectTypeOf, it } from "vitest"

import { createExpressionChecker, createRowEvaluator } from "@pliantui/core"

import { defineDataset, type InferRow } from "./define-dataset"

const orders = defineDataset({
  id: "orders",
  describe: "Customer orders placed through the portal",
  timeZone: "Asia/Kolkata",
  fields: {
    id: { type: "id" },
    value: { type: "currency", currency: "INR", label: "Value" },
    weight: { type: "number", unit: "kilogram" },
    discount: { type: "percent" },
    region: { type: "enum", values: ["north", "south"] },
    placedOn: { type: "date" },
    paid: { type: "boolean" },
    notes: { type: "text" },
  },
})

function problemsOf(definition: unknown) {
  try {
    // @ts-expect-error JavaScript callers can pass anything
    defineDataset(definition)
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError)
    return error instanceof Error ? error.message : ""
  }
  throw new Error("defineDataset didn't throw")
}

const valid = {
  id: "orders",
  fields: { id: { type: "id" }, total: { type: "number" } },
}

function withField(field: unknown) {
  return { ...valid, fields: { ...valid.fields, total: field } }
}

describe("defineDataset", () => {
  it("resolves each field's capabilities from its type", () => {
    expect(orders.fields.value).toEqual({
      type: "currency",
      currency: "INR",
      label: "Value",
      sortable: true,
      filterable: true,
      groupable: false,
      aggregatable: true,
    })
    expect(orders.fields.region).toMatchObject({
      groupable: true,
      aggregatable: true,
    })
    expect(orders.fields.placedOn.groupable).toBe(true)
    expect(orders.fields.weight.groupable).toBe(false)
    expect(orders.fields.notes).toMatchObject({
      sortable: false,
      filterable: "search",
      groupable: false,
      aggregatable: false,
    })
  })

  it("lets a field override its type's capabilities", () => {
    const dataset = defineDataset({
      id: "orders",
      fields: {
        id: { type: "id", filterable: false, sortable: undefined },
        notes: { type: "text", sortable: true, filterable: false },
      },
    })
    expect(dataset.fields.id.filterable).toBe(false)
    expect(dataset.fields.id.sortable).toBe(true)
    expect(dataset.fields.notes).toMatchObject({
      sortable: true,
      filterable: false,
    })
  })

  it("uses the id field as the row key unless rowKey names others", () => {
    expect(orders.rowKey).toEqual(["id"])
    const lines = defineDataset({
      id: "order-lines",
      fields: { orderId: { type: "id" }, line: { type: "integer" } },
      rowKey: ["orderId", "line"],
    })
    expect(lines.rowKey).toEqual(["orderId", "line"])
  })

  it("defaults the time zone to UTC when no field is a date", () => {
    const undated = defineDataset({
      id: "orders",
      fields: { id: { type: "id" }, total: { type: "number" } },
    })
    expect(undated.timeZone).toBe("UTC")
    expect(orders.timeZone).toBe("Asia/Kolkata")
  })

  it("can't be changed after it is checked", () => {
    const values: ["north", "south"] = ["north", "south"]
    const dataset = defineDataset({
      id: "regions",
      fields: { id: { type: "id" }, region: { type: "enum", values } },
    })
    expect(Object.isFrozen(dataset.fields.region)).toBe(true)
    expect(Reflect.set(dataset.fields.region, "sortable", false)).toBe(false)
    expect(Reflect.set(dataset.fields.region.values, 0, "west")).toBe(false)
    expect(dataset.fields.region.values).toEqual(["north", "south"])
    values[0] = "north"
    expect(Object.isFrozen(values)).toBe(false)
  })

  it("feeds core's expression checker and row evaluator", () => {
    const check = createExpressionChecker({ fields: orders.fields })
    expect(
      check(
        { fn: "mul", args: [{ field: "value" }, { field: "discount" }] },
        "row"
      )
    ).toEqual({ success: true, data: { type: "number", unit: "INR" } })
    expect(
      check(
        { fn: "add", args: [{ field: "value" }, { field: "weight" }] },
        "row"
      ).success
    ).toBe(false)

    const evaluate = createRowEvaluator<InferRow<typeof orders>>({
      fields: orders.fields,
      timeZone: orders.timeZone,
    })
    const net = evaluate({
      fn: "mul",
      args: [{ field: "value" }, { field: "discount" }],
    })
    if (!net.success) {
      throw new Error("the expression should check")
    }
    expect(
      net.data.accessor({
        id: "o-1",
        value: 200,
        weight: null,
        discount: 0.25,
        region: "north",
        placedOn: "2026-11-20",
        paid: true,
        notes: null,
      })
    ).toBe(50)
  })

  it("types rows from the fields", () => {
    type Row = InferRow<typeof orders>
    expectTypeOf<Row["id"]>().toEqualTypeOf<string>()
    expectTypeOf<Row["value"]>().toEqualTypeOf<number | null>()
    expectTypeOf<Row["region"]>().toEqualTypeOf<"north" | "south" | null>()
    expectTypeOf<Row["placedOn"]>().toEqualTypeOf<string | Date | null>()
    expectTypeOf<Row["paid"]>().toEqualTypeOf<boolean | null>()
    expectTypeOf(orders.fields.region.values).toEqualTypeOf<
      readonly ["north", "south"]
    >()
  })

  it("needs a row key in its types", () => {
    expect(() =>
      // @ts-expect-error without an id field, rowKey is required
      defineDataset({ id: "orders", fields: { number: { type: "string" } } })
    ).toThrow(TypeError)
    expect(() =>
      defineDataset({
        id: "orders",
        fields: { number: { type: "string" } },
        // @ts-expect-error rowKey must name a field
        rowKey: "code",
      })
    ).toThrow(TypeError)
  })

  describe("throws a TypeError", () => {
    it("for a bad dataset or field id", () => {
      expect(problemsOf({ ...valid, id: "1orders" })).toContain(
        'id "1orders" must start with a letter'
      )
      expect(
        problemsOf({ ...valid, fields: { ...valid.fields, "total value": {} } })
      ).toContain('field id "total value" must start with a letter')
    })

    it("for an unknown type, unit or currency", () => {
      expect(problemsOf(withField({ type: "money" }))).toContain(
        'field "total": unknown type "money"'
      )
      expect(
        problemsOf(withField({ type: "number", unit: "parsec" }))
      ).toContain('field "total": unknown unit "parsec"')
      expect(
        problemsOf(withField({ type: "number", unit: "percent" }))
      ).toContain("use the percent type")
      expect(
        problemsOf(withField({ type: "currency", currency: "usd" }))
      ).toContain('field "total": unknown currency "usd"')
    })

    it("for an unknown option, which is usually a typo", () => {
      expect(
        problemsOf(withField({ type: "number", sortible: true }))
      ).toContain('field "total": unknown option "sortible"')
      expect(problemsOf({ ...valid, scope: "public" })).toContain(
        'unknown option "scope"'
      )
    })

    it("for a format that doesn't fit its field", () => {
      expect(
        problemsOf(
          withField({
            type: "number",
            format: { type: "date", style: "short" },
          })
        )
      ).toContain("format must be a number format")
      expect(
        problemsOf(
          withField({
            type: "currency",
            currency: "INR",
            format: { type: "currency", currency: "USD" },
          })
        )
      ).toContain('format can\'t change the currency from "INR"')
      expect(
        problemsOf(
          withField({
            type: "number",
            format: { type: "number", unit: "meter" },
          })
        )
      ).toContain("format can't add a unit")
    })

    it("for bad enum values and capabilities", () => {
      expect(problemsOf(withField({ type: "enum", values: [] }))).toContain(
        "values must list at least one non-empty string"
      )
      expect(
        problemsOf(withField({ type: "enum", values: ["a", "a"] }))
      ).toContain("values must not repeat")
      expect(
        problemsOf(withField({ type: "number", filterable: "search" }))
      ).toContain('filterable: "search" needs a text field')
    })

    it("for a missing or invalid row key", () => {
      expect(
        problemsOf({ id: "orders", fields: { code: { type: "string" } } })
      ).toContain('has no row key: add a field named "id"')
      expect(problemsOf({ ...valid, rowKey: "code" })).toContain(
        'rowKey names "code", which isn\'t a field'
      )
      expect(problemsOf({ ...valid, rowKey: "total" })).toContain(
        'rowKey field "total" must be an id, string, integer, email or url field'
      )
      expect(problemsOf({ ...valid, rowKey: ["id", "id"] })).toContain(
        "rowKey must not name a field twice"
      )
    })

    it("for a date without a known time zone", () => {
      const dated = withField({ type: "date" })
      expect(problemsOf(dated)).toContain("timeZone is required")
      expect(problemsOf({ ...dated, timeZone: "Mars/Olympus" })).toContain(
        'unknown time zone "Mars/Olympus"'
      )
    })

    it("listing every problem at once", () => {
      const message = problemsOf({
        id: "orders",
        fields: { a: { type: "money" }, b: { type: "number", unit: "parsec" } },
      })
      expect(message).toMatch(/^Invalid dataset "orders":/)
      expect(message).toContain('field "a": unknown type')
      expect(message).toContain('field "b": unknown unit')
      expect(message).toContain("has no row key")
    })
  })
})
