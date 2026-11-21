import { describe, expect, expectTypeOf, it } from "vitest"

import { createExpressionChecker, createRowEvaluator } from "@pliantui/core"

import type { DatasetFieldType } from "./dataset-field"
import { defineDataset, type InferRow } from "./define-dataset"
import { describeDataset } from "./describe-dataset"

const orders = defineDataset({
  id: "orders",
  scope: "public",
  describe: "Customer orders placed through the portal",
  timeZone: "Asia/Tokyo",
  fields: {
    id: { type: "id" },
    value: { type: "currency", currency: "JPY", label: "Value" },
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
  scope: "public",
  fields: { id: { type: "id" }, total: { type: "number" } },
}

function withField(field: unknown) {
  return { ...valid, fields: { ...valid.fields, total: field } }
}

function fieldOf(field: unknown) {
  const dataset = defineDataset({
    id: "orders",
    scope: "public",
    timeZone: "UTC",
    // @ts-expect-error a field built at runtime
    fields: { id: { type: "id" }, total: field },
  })
  return Object.entries(dataset.fields).find(([id]) => id === "total")?.[1]
}

const textValued = ["string", "text", "enum", "id", "url", "email"]

const capabilities: Record<
  DatasetFieldType,
  readonly [boolean, boolean | "search", boolean, boolean]
> = {
  string: [true, true, true, true],
  text: [false, "search", false, false],
  number: [true, true, false, true],
  integer: [true, true, false, true],
  currency: [true, true, false, true],
  percent: [true, true, false, true],
  boolean: [true, true, true, true],
  date: [true, true, true, true],
  datetime: [true, true, false, true],
  enum: [true, true, true, true],
  id: [true, true, false, true],
  url: [true, true, false, true],
  email: [true, true, false, true],
}

const fieldsOfType: Record<DatasetFieldType, object> = {
  string: {},
  text: {},
  number: {},
  integer: {},
  currency: { currency: "USD" },
  percent: {},
  boolean: {},
  date: {},
  datetime: {},
  enum: { values: ["a"] },
  id: {},
  url: {},
  email: {},
}

describe("defineDataset", () => {
  it.each(Object.entries(capabilities))(
    "gives a %s field its type's capabilities",
    (type, [sortable, filterable, groupable, aggregatable]) => {
      expect(
        fieldOf({ type, ...fieldsOfType[type as DatasetFieldType] })
      ).toMatchObject({ sortable, filterable, groupable, aggregatable })
    }
  )

  it("keeps a field's own options next to its capabilities", () => {
    expect(orders.fields.value).toEqual({
      type: "currency",
      currency: "JPY",
      label: "Value",
      sortable: true,
      filterable: true,
      groupable: false,
      aggregatable: true,
      exposeToAI: true,
    })
  })

  it("lets a field override its type's capabilities", () => {
    const dataset = defineDataset({
      id: "orders",
      scope: "public",
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

  it.each(Object.keys(capabilities))(
    'allows filterable: "search" only on text-valued fields (%s)',
    (type) => {
      const field = {
        type,
        filterable: "search",
        ...fieldsOfType[type as DatasetFieldType],
      }
      if (textValued.includes(type)) {
        expect(fieldOf(field)?.filterable).toBe("search")
      } else {
        expect(problemsOf(withField(field))).toContain(
          `filterable: "search" needs a text-valued field, not a ${type} field`
        )
      }
    }
  )

  it("uses the id field as the row key unless rowKey names others", () => {
    expect(orders.rowKey).toEqual(["id"])
    const lines = defineDataset({
      id: "order-lines",
      scope: "public",
      fields: { orderId: { type: "id" }, line: { type: "integer" } },
      rowKey: ["orderId", "line"],
    })
    expect(lines.rowKey).toEqual(["orderId", "line"])
  })

  it("rejects a row key of more than 10 fields", () => {
    const fields = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `k${String(index)}`,
        { type: "string" } as const,
      ])
    )
    const keys = Object.keys(fields)
    expect(problemsOf({ id: "orders", fields, rowKey: keys })).toContain(
      "rowKey must name 1 to 10 fields"
    )
    expect(
      problemsOf({
        id: "orders",
        fields,
        rowKey: [...keys.slice(0, 101), "missing"],
      })
    ).toContain("rowKey must name 1 to 10 fields")
    expect(
      defineDataset({
        id: "orders",
        scope: "public",
        fields,
        rowKey: ["k0", ...keys.slice(1, 10)],
      }).rowKey
    ).toHaveLength(10)
  })

  it("accepts a row key that isn't sortable", () => {
    const dataset = defineDataset({
      id: "orders",
      scope: "public",
      fields: { id: { type: "id", sortable: false } },
    })
    expect(dataset.rowKey).toEqual(["id"])
  })

  describe("time zone", () => {
    function zoneOf(timeZone: string) {
      return defineDataset({
        id: "orders",
        scope: "public",
        timeZone,
        fields: { id: { type: "id" }, placedOn: { type: "date" } },
      }).timeZone
    }

    it("defaults to UTC when no field is a date", () => {
      const undated = defineDataset({
        id: "orders",
        scope: "public",
        fields: { id: { type: "id" }, total: { type: "number" } },
      })
      expect(undated.timeZone).toBe("UTC")
    })

    it("accepts UTC and Area/Location names, kept exactly as written", () => {
      for (const timeZone of [
        "UTC",
        "utc",
        "America/New_York",
        "US/Pacific",
        "Asia/Kolkata",
        "asia/kolkata",
        "Europe/Kyiv",
      ]) {
        expect(zoneOf(timeZone)).toBe(timeZone)
      }
    })

    it.each([
      [
        "abbreviations",
        ["PST", "BST", "IST", "EST", "GMT", "Japan", "EST5EDT"],
      ],
      ["offsets", ["+05:30", "-08:00", "UTC+1"]],
      ["Etc/ zones", ["Etc/UTC", "etc/gmt-14"]],
      ["SystemV/ zones", ["SystemV/EST5", "systemv/est5"]],
      ["unknown zones", ["Mars/Olympus", "", " UTC"]],
    ])("rejects %s", (_, timeZones) => {
      for (const timeZone of timeZones) {
        expect(
          problemsOf({ ...withField({ type: "date" }), timeZone })
        ).toContain(
          `timeZone ${JSON.stringify(timeZone)} must be "UTC" or an Area/Location time zone name, such as "Asia/Tokyo"`
        )
      }
    })
  })

  describe("reads the definition once, as plain data", () => {
    it("calls each getter once and keeps what it returned", () => {
      let reads = 0
      const field = {
        type: "string",
        get label() {
          reads++
          return reads === 1 ? "Name" : { column: "users.password" }
        },
      }
      const dataset = defineDataset({
        id: "users",
        scope: "public",
        // @ts-expect-error a field with a getter
        fields: { id: { type: "id" }, name: field },
      })
      const described = describeDataset(dataset, { audience: "ai", user: null })
      expect(reads).toBe(1)
      expect(described?.fields["name"]).toMatchObject({ label: "Name" })
      expect(JSON.stringify(described)).not.toContain("password")
    })

    it("checks the same fields it keeps", () => {
      let reads = 0
      const definition = {
        id: "orders",
        scope: "public",
        get fields() {
          reads++
          return reads === 1
            ? { id: { type: "id" } }
            : { id: { type: "id" }, secret: { type: "string", column: "x" } }
        },
      }
      // @ts-expect-error fields from a getter
      const dataset = defineDataset(definition)
      expect(Object.keys(dataset.fields)).toEqual(["id"])
      expect(Object.keys(definition.fields)).toContain("secret")
    })

    it("calls getters inside formats and enum values once", () => {
      let formatReads = 0
      const format = {
        type: "number",
        get decimals() {
          formatReads++
          return formatReads === 1 ? 2 : 99
        },
      }
      let valueReads = 0
      const values = ["a", "b"]
      Object.defineProperty(values, 0, {
        enumerable: true,
        get() {
          valueReads++
          return valueReads === 1 ? "a" : { secret: 1 }
        },
      })
      const dataset = defineDataset({
        id: "orders",
        scope: "public",
        fields: {
          id: { type: "id" },
          // @ts-expect-error a format with a getter
          total: { type: "number", format },
          // @ts-expect-error values with a getter
          state: { type: "enum", values },
        },
      })
      expect([formatReads, valueReads]).toEqual([1, 1])
      expect(
        describeDataset(dataset, { audience: "client", user: null })?.fields
      ).toMatchObject({
        total: { format: { type: "number", decimals: 2 } },
        state: { values: ["a", "b"] },
      })
    })

    it("treats ids that Object.prototype also has as plain fields", () => {
      const dataset = defineDataset({
        id: "classes",
        scope: "public",
        fields: { constructor: { type: "string" }, toString: { type: "text" } },
        rowKey: "constructor",
      })
      expect(dataset.rowKey).toEqual(["constructor"])
      expect(
        Object.keys(
          describeDataset(dataset, { audience: "ai", user: null })?.fields ?? {}
        )
      ).toEqual(["constructor", "toString"])
      expect(
        problemsOf({
          id: "classes",
          fields: { name: { type: "string" } },
          rowKey: "toString",
        })
      ).toContain('rowKey names "toString", which isn\'t a field')
    })

    it("ignores inherited properties", () => {
      const inherited: unknown = Object.create({ type: "string" })
      expect(problemsOf(withField(inherited))).toContain(
        'field "total": unknown type undefined'
      )
    })

    it("keeps its own frozen copy and leaves the caller's objects alone", () => {
      const values: ["north", "south"] = ["north", "south"]
      const format = { type: "number", decimals: 1 } as const
      const fields = {
        id: { type: "id" },
        region: { type: "enum", values },
        weight: { type: "number", format },
      } as const
      const dataset = defineDataset({ id: "regions", scope: "public", fields })
      expect(Object.isFrozen(dataset.fields.region.values)).toBe(true)
      expect(Reflect.set(dataset.fields.region, "sortable", false)).toBe(false)

      Reflect.set(values, 0, "west")
      expect(dataset.fields.region.values).toEqual(["north", "south"])
      expect(Object.isFrozen(values)).toBe(false)
      expect(Object.isFrozen(format)).toBe(false)
      expect(Object.isFrozen(fields)).toBe(false)
    })
  })

  it("feeds core's expression checker and row evaluator", () => {
    const check = createExpressionChecker({ fields: orders.fields })
    expect(
      check(
        { fn: "mul", args: [{ field: "value" }, { field: "discount" }] },
        "row"
      )
    ).toEqual({ success: true, data: { type: "number", unit: "JPY" } })
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

  describe("types", () => {
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

    it("rejects options a field's type doesn't take", () => {
      expect(() =>
        defineDataset({
          id: "orders",
          scope: "public",
          // @ts-expect-error a misspelled option
          fields: { id: { type: "id", sortible: true } },
        })
      ).toThrow(TypeError)
      expect(() =>
        defineDataset({
          id: "orders",
          scope: "public",
          fields: {
            id: { type: "id" },
            // @ts-expect-error text fields have no unit
            notes: { type: "text", unit: "meter" },
          },
        })
      ).toThrow(TypeError)
      expect(() =>
        defineDataset({
          id: "orders",
          scope: "public",
          timeZone: "UTC",
          fields: {
            id: { type: "id" },
            day: {
              type: "date",
              // @ts-expect-error a date has no time to show
              format: { type: "date", style: "short", time: true },
            },
          },
        })
      ).toThrow(TypeError)
    })

    it("needs a row key that can identify rows", () => {
      expect(() =>
        // @ts-expect-error without an id field, rowKey is required
        defineDataset({ id: "orders", fields: { number: { type: "string" } } })
      ).toThrow(TypeError)
      expect(() =>
        defineDataset({
          id: "orders",
          scope: "public",
          fields: { number: { type: "string" } },
          // @ts-expect-error rowKey must name a field
          rowKey: "code",
        })
      ).toThrow(TypeError)
      expect(() =>
        defineDataset({
          id: "orders",
          scope: "public",
          fields: { total: { type: "number" } },
          // @ts-expect-error a number can't be a row key
          rowKey: "total",
        })
      ).toThrow(TypeError)
    })

    it("needs a time zone with a date field", () => {
      expect(() =>
        // @ts-expect-error timeZone is required with a date field
        defineDataset({
          id: "orders",
          scope: "public",
          fields: { id: { type: "id" }, day: { type: "date" } },
        })
      ).toThrow(TypeError)
    })
  })

  describe("throws a TypeError", () => {
    it.each([
      ["null", null, "the definition must be an object"],
      ["a string", "orders", "the definition must be an object"],
      [
        "a bad dataset id",
        { ...valid, id: "1orders" },
        'id "1orders" must start with a letter',
      ],
      [
        "an unknown option",
        { ...valid, source: "orders" },
        'unknown option "source"',
      ],
      [
        "no scope",
        { ...valid, scope: undefined },
        'scope must be a function of the user, or "public"',
      ],
      [
        "a scope that is neither a function nor public",
        { ...valid, scope: { orgId: 1 } },
        'scope must be a function of the user, or "public"',
      ],
      [
        "an access that isn't a function",
        { ...valid, access: true },
        "access must be a function",
      ],
      [
        "an unknown privacy option",
        { ...valid, privacy: { minGroup: 5 } },
        "privacy must be { minGroupSize }, a whole number of at least 1",
      ],
      [
        "a minimum group size below 1",
        { ...valid, privacy: { minGroupSize: 0 } },
        "privacy must be { minGroupSize }, a whole number of at least 1",
      ],
      [
        "a fractional minimum group size",
        { ...valid, privacy: { minGroupSize: 2.5 } },
        "privacy must be { minGroupSize }, a whole number of at least 1",
      ],
      [
        "a field access that isn't a function",
        withField({ type: "number", access: "finance" }),
        'field "total": access must be a function',
      ],
      [
        "an exposeToAI that isn't a boolean",
        withField({ type: "number", exposeToAI: "no" }),
        'field "total": exposeToAI must be a boolean',
      ],
      [
        "a row key field with access",
        { ...valid, fields: { id: { type: "id", access: () => true } } },
        'rowKey field "id" can\'t set access or exposeToAI: false',
      ],
      [
        "a row key field kept from the model",
        { ...valid, fields: { id: { type: "id", exposeToAI: false } } },
        'rowKey field "id" can\'t set access or exposeToAI: false',
      ],
      [
        "an empty describe",
        { ...valid, describe: "  " },
        "describe must be non-empty text of up to 500 characters",
      ],
      [
        "a long describe",
        { ...valid, describe: "x".repeat(501) },
        "describe must be non-empty text of up to 500 characters",
      ],
      [
        "fields that aren't an object",
        { id: "orders", fields: [] },
        "fields must be an object of fields by id",
      ],
      [
        "no fields",
        { id: "orders", fields: {}, rowKey: "id" },
        "fields must declare at least one field",
      ],
      [
        "a bad field id",
        { ...valid, fields: { ...valid.fields, "total value": {} } },
        'field id "total value" must start with a letter',
      ],
      [
        "an array as a field",
        withField(["number"]),
        'field "total": must be an object',
      ],
      [
        "a field that isn't an object",
        withField("number"),
        'field "total": must be an object',
      ],
      [
        "an unknown type",
        withField({ type: "money" }),
        'field "total": unknown type "money"',
      ],
      [
        "an unknown field option",
        withField({ type: "number", sortible: true }),
        'field "total": unknown option "sortible" for a number field',
      ],
      [
        "an option of another type",
        withField({ type: "text", unit: "meter" }),
        'field "total": unknown option "unit" for a text field',
      ],
      [
        "an empty label",
        withField({ type: "number", label: " " }),
        "label must be non-empty text of up to 80 characters",
      ],
      [
        "a long label",
        withField({ type: "number", label: "x".repeat(81) }),
        "label must be non-empty text of up to 80 characters",
      ],
      [
        "a long field describe",
        withField({ type: "number", describe: "x".repeat(201) }),
        "describe must be non-empty text of up to 200 characters",
      ],
      [
        "a capability that isn't a boolean",
        withField({ type: "number", sortable: "yes" }),
        'field "total": sortable must be a boolean',
      ],
      [
        "a bad filterable",
        withField({ type: "number", filterable: "yes" }),
        'field "total": filterable must be a boolean or "search"',
      ],
      [
        "an unknown currency",
        withField({ type: "currency", currency: "usd" }),
        'field "total": unknown currency "usd"',
      ],
      [
        "a missing currency",
        withField({ type: "currency" }),
        'field "total": unknown currency undefined',
      ],
      [
        "an unknown unit",
        withField({ type: "number", unit: "parsec" }),
        'field "total": unknown unit "parsec"',
      ],
      [
        "the percent unit",
        withField({ type: "integer", unit: "percent" }),
        'use the percent type instead of the unit "percent"',
      ],
      [
        "no enum values",
        withField({ type: "enum", values: [] }),
        "values must list 1 to 100 values, each non-empty text of up to 80 characters",
      ],
      [
        "too many enum values",
        withField({
          type: "enum",
          values: Array.from(
            { length: 101 },
            (_, index) => `v${String(index)}`
          ),
        }),
        "values must list 1 to 100 values",
      ],
      [
        "a blank enum value",
        withField({ type: "enum", values: ["a", " "] }),
        "values must list 1 to 100 values",
      ],
      [
        "a long enum value",
        withField({ type: "enum", values: ["x".repeat(81)] }),
        "values must list 1 to 100 values",
      ],
      [
        "repeated enum values",
        withField({ type: "enum", values: ["a", "a"] }),
        "values must not repeat",
      ],
      [
        "a format of another type",
        withField({ type: "number", format: { type: "date", style: "short" } }),
        'format must be a "number" format',
      ],
      [
        "a format with an unknown option",
        withField({ type: "number", format: { type: "number", secret: 1 } }),
        'format must be a "number" format',
      ],
      [
        "a format that changes the currency",
        withField({
          type: "currency",
          currency: "INR",
          format: { type: "currency", currency: "USD" },
        }),
        'format can\'t change the currency from "INR"',
      ],
      [
        "a format that adds a unit",
        withField({
          type: "number",
          format: { type: "number", unit: "meter" },
        }),
        "format can't add a unit; declare it as the field's unit",
      ],
      [
        "a format that changes the unit",
        withField({
          type: "number",
          unit: "kilogram",
          format: { type: "number", unit: "gram" },
        }),
        'format can\'t change the unit from "kilogram"',
      ],
      [
        "a date format with a time on a date field",
        {
          ...withField({
            type: "date",
            format: { type: "date", style: "short", time: true },
          }),
          timeZone: "UTC",
        },
        "format can't show a time for a date field, which has none",
      ],
      [
        "no row key",
        { id: "orders", fields: { code: { type: "string" } } },
        'has no row key: add a field named "id"',
      ],
      [
        "an empty row key",
        { ...valid, rowKey: [] },
        "rowKey must name 1 to 10 fields",
      ],
      [
        "a row key naming a field twice",
        { ...valid, rowKey: ["id", "id"] },
        "rowKey must not name a field twice",
      ],
      [
        "a row key naming no field",
        { ...valid, rowKey: "code" },
        'rowKey names "code", which isn\'t a field',
      ],
      [
        "a null row key",
        { ...valid, rowKey: null },
        "rowKey names null, which isn't a field",
      ],
      [
        "a row key that isn't text",
        { ...valid, rowKey: 5 },
        "rowKey names 5, which isn't a field",
      ],
      [
        "a row key of the wrong type",
        { ...valid, rowKey: "total" },
        'rowKey field "total" must be an id, string, integer, email or url field',
      ],
      [
        "a date without a time zone",
        withField({ type: "datetime" }),
        "timeZone is required because a field is a date or datetime",
      ],
      [
        "a time zone that isn't text",
        { ...valid, timeZone: 5 },
        'timeZone 5 must be "UTC" or an Area/Location time zone name',
      ],
    ])("for %s", (_, definition, message) => {
      expect(problemsOf(definition)).toContain(message)
    })

    it("listing every problem at once", () => {
      const message = problemsOf({
        id: "orders",
        fields: { a: { type: "money" }, b: { type: "number", unit: "parsec" } },
      })
      expect(message).toMatch(/^Invalid dataset "orders":\n- /)
      expect(message).toContain('field "a": unknown type')
      expect(message).toContain('field "b": unknown unit')
      expect(message).toContain("has no row key")
    })

    it("listing the first 20 problems", () => {
      const fields = Object.fromEntries(
        Array.from({ length: 25 }, (_, index) => [
          `f${String(index)}`,
          { type: "money" },
        ])
      )
      const message = problemsOf({
        id: "orders",
        scope: "public",
        fields,
        rowKey: "f0",
      })
      expect(message.split("\n- ")).toHaveLength(22)
      expect(message).toMatch(/\n- …and 6 more$/)
    })

    it("without reading more of a huge list than it reports", () => {
      let reads = 0
      const values = new Proxy(Array.from({ length: 10_000 }, String), {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) {
            reads++
          }
          const value: unknown = Reflect.get(target, key, receiver)
          return value
        },
      })
      expect(problemsOf(withField({ type: "enum", values }))).toContain(
        "values must list 1 to 100 values"
      )
      expect(reads).toBeLessThanOrEqual(101)
    })

    it("without a name when the definition has no id", () => {
      expect(problemsOf(null)).toBe(
        "Invalid dataset:\n- the definition must be an object"
      )
    })
  })
})
