import { describe, expect, it } from "vitest"

import type { Expression } from "@pliantui/contract"

import {
  checkExpression,
  type CheckExpressionOptions,
  type ExpressionField,
} from "./check-expression"

const fields: Record<string, ExpressionField> = {
  name: { type: "string" },
  notes: { type: "text" },
  region: { type: "enum" },
  orderId: { type: "id" },
  site: { type: "url" },
  contact: { type: "email" },
  score: { type: "number" },
  qty: { type: "integer" },
  weight: { type: "number", unit: "kg" },
  price: { type: "currency", currency: "USD" },
  cost: { type: "currency", currency: "USD" },
  fee: { type: "currency", currency: "EUR" },
  discount: { type: "percent" },
  margin: { type: "percent" },
  active: { type: "boolean" },
  placed: { type: "date" },
  shipped: { type: "datetime" },
}

const field = (id: string): Expression => ({ field: id })
const value = (literal: string | number | boolean | null): Expression => ({
  value: literal,
})
const ref = (id: string): Expression => ({ ref: id })
const fn = (name: string, ...args: Expression[]): Expression => ({
  fn: name,
  args,
})

function row(
  expression: Expression,
  options: Partial<CheckExpressionOptions> = {}
) {
  return checkExpression(expression, { kind: "row", fields, ...options })
}

function aggregate(
  expression: Expression,
  options: Partial<CheckExpressionOptions> = {}
) {
  return checkExpression(expression, { kind: "aggregate", fields, ...options })
}

function issues(result: ReturnType<typeof checkExpression>) {
  return result.error?.issues.map(({ code, path, message }) => ({
    code,
    path,
    message,
  }))
}

function messages(result: ReturnType<typeof checkExpression>) {
  return result.error?.issues.map(({ message }) => message)
}

describe("checkExpression", () => {
  describe("field", () => {
    it.each([
      ["name", { type: "string" }],
      ["notes", { type: "string" }],
      ["region", { type: "string" }],
      ["orderId", { type: "string" }],
      ["site", { type: "string" }],
      ["contact", { type: "string" }],
      ["score", { type: "number" }],
      ["qty", { type: "integer" }],
      ["weight", { type: "number", unit: "kg" }],
      ["price", { type: "number", unit: "USD" }],
      ["discount", { type: "number", unit: "percent" }],
      ["active", { type: "boolean" }],
      ["placed", { type: "date" }],
      ["shipped", { type: "datetime" }],
    ])("reads %s with its type and unit", (id, type) => {
      expect(row(field(id)).data).toEqual(type)
    })

    it("ignores a unit declared on a field that isn't a number", () => {
      expect(
        row(field("label"), {
          fields: { label: { type: "string", unit: "kg" } },
        }).data
      ).toEqual({ type: "string" })
    })

    it("rejects an unknown field at its path", () => {
      expect(issues(row(fn("abs", field("missing"))))).toEqual([
        {
          code: "custom",
          path: ["args", 0, "field"],
          message: "Unknown field missing",
        },
      ])
    })

    it("rejects a field named like an object property", () => {
      expect(messages(row(field("constructor")))).toEqual([
        "Unknown field constructor",
      ])
    })

    it("rejects dotted paths, which are reserved for relations", () => {
      expect(
        messages(
          row(field("customer.region"), {
            fields: { ...fields, "customer.region": { type: "string" } },
          })
        )
      ).toEqual([
        "Dotted paths like customer.region are reserved for relations",
      ])
      expect(messages(row(ref("items.total")))).toEqual([
        "Dotted paths like items.total are reserved for relations",
      ])
    })
  })

  describe("value", () => {
    it.each([
      ["a", { type: "string" }],
      [3, { type: "integer" }],
      [-3, { type: "integer" }],
      [3.5, { type: "number" }],
      [true, { type: "boolean" }],
      [null, { type: "null" }],
    ] as const)("types the literal %j", (literal, type) => {
      expect(row(value(literal)).data).toEqual(type)
    })

    it("keeps a string literal that looks like a date a string", () => {
      expect(row(value("2024-01-01")).data).toEqual({ type: "string" })
    })
  })

  describe("ref", () => {
    const derived = {
      total: fn("mul", field("price"), field("qty")),
      net: fn("sub", ref("total"), field("cost")),
      day: value("2024-01-01"),
      position: fn("rank", field("score")),
      broken: field("missing"),
      wrapper: ref("broken"),
    }
    const aggregates = {
      revenue: fn("sum", field("price")),
      orders: fn("count"),
      average: fn("div", ref("revenue"), ref("orders")),
      net: fn("sum", ref("net")),
    }

    it("resolves a derived field in a row expression", () => {
      expect(row(ref("net"), { derived }).data).toEqual({
        type: "number",
        unit: "USD",
      })
    })

    it("resolves an aggregate in an aggregate expression", () => {
      expect(aggregate(ref("average"), { derived, aggregates }).data).toEqual({
        type: "number",
        unit: "USD",
      })
    })

    it("resolves a derived field inside an aggregate function", () => {
      expect(
        aggregate(fn("max", ref("total")), { derived, aggregates }).data
      ).toEqual({ type: "number", unit: "USD" })
    })

    it("picks the derived field or the aggregate by position when both share an id", () => {
      expect(aggregate(ref("net"), { derived, aggregates }).data).toEqual({
        type: "number",
        unit: "USD",
      })
      expect(
        aggregate(fn("count", ref("net")), { derived, aggregates }).data
      ).toEqual({ type: "integer" })
    })

    it("doesn't read a referenced string literal as a date", () => {
      expect(messages(row(fn("age", ref("day")), { derived }))).toEqual([
        "Must be a date or datetime, not string",
      ])
    })

    it("rejects an unknown ref", () => {
      expect(issues(row(fn("abs", ref("nope")), { derived }))).toEqual([
        {
          code: "custom",
          path: ["args", 0, "ref"],
          message: "Unknown derived field or aggregate nope",
        },
      ])
    })

    it("rejects an aggregate in a row expression", () => {
      expect(messages(row(ref("revenue"), { derived, aggregates }))).toEqual([
        "revenue is an aggregate, which a row expression can't use",
      ])
    })

    it("rejects an aggregate nested in an aggregate function", () => {
      expect(
        messages(aggregate(fn("sum", ref("revenue")), { aggregates }))
      ).toEqual(["revenue is an aggregate, which can't be nested in sum"])
    })

    it("rejects a derived field outside an aggregate function in an aggregate expression", () => {
      expect(messages(aggregate(ref("total"), { derived }))).toEqual([
        "total is a derived field, which an aggregate expression can use only inside an aggregate function",
      ])
    })

    it("reports the root cause of an invalid referenced item", () => {
      expect(issues(row(ref("wrapper"), { derived }))).toEqual([
        {
          code: "custom",
          path: ["ref"],
          message: "wrapper is invalid: Unknown field missing",
        },
      ])
    })

    it("rejects a self-reference", () => {
      expect(
        messages(row(ref("loop"), { derived: { loop: ref("loop") } }))
      ).toEqual(["loop is invalid: Circular reference: loop → loop"])
    })

    it("rejects a cycle through several items", () => {
      const cyclic = {
        a: fn("add", ref("b"), value(1)),
        b: fn("abs", ref("c")),
        c: fn("mul", ref("a"), value(2)),
      }
      expect(messages(row(ref("a"), { derived: cyclic }))).toEqual([
        "a is invalid: Circular reference: a → b → c → a",
      ])
      expect(messages(row(ref("c"), { derived: cyclic }))).toEqual([
        "c is invalid: Circular reference: c → a → b → c",
      ])
    })

    it("rejects a cycle between aggregates", () => {
      expect(
        messages(
          aggregate(ref("x"), {
            aggregates: { x: fn("add", ref("y"), value(1)), y: ref("x") },
          })
        )
      ).toEqual(["x is invalid: Circular reference: x → y → x"])
    })

    it("checks a shared reference once without calling it a cycle", () => {
      expect(
        row(fn("add", ref("total"), ref("total")), { derived }).data
      ).toEqual({ type: "number", unit: "USD" })
    })

    it("allows a derived field with a window function in a row expression", () => {
      expect(
        row(fn("add", ref("position"), value(1)), { derived }).data
      ).toEqual({ type: "integer" })
    })

    it("rejects a derived field with a window function inside an aggregate or window function", () => {
      expect(
        messages(aggregate(fn("sum", ref("position")), { derived }))
      ).toEqual([
        "position uses a window function, which can't be nested in sum",
      ])
      expect(
        messages(
          row(fn("rank", ref("outer")), {
            derived: { ...derived, outer: fn("abs", ref("position")) },
          })
        )
      ).toEqual(["outer uses a window function, which can't be nested in rank"])
    })
  })

  describe("fn", () => {
    it("rejects an unknown or namespaced function", () => {
      expect(issues(row(fn("abs", fn("frobnicate"))))).toEqual([
        {
          code: "custom",
          path: ["args", 0, "fn"],
          message: "Unknown function frobnicate",
        },
      ])
      expect(messages(row(fn("acme:gpa", field("score"))))).toEqual([
        "Unknown function acme:gpa",
      ])
      expect(messages(row(fn("toString")))).toEqual([
        "Unknown function toString",
      ])
    })

    it.each([
      [fn("abs"), "abs takes 1 argument"],
      [fn("add", value(1)), "add takes 2 arguments"],
      [fn("today", value(1)), "today takes no arguments"],
      [
        fn("round", value(1), value(1), value(1)),
        "round takes 1 to 2 arguments",
      ],
      [fn("and", value(true)), "and takes at least 2 arguments"],
    ])("checks the number of arguments of %j", (expression, message) => {
      expect(issues(row(expression))).toEqual([
        { code: "custom", path: ["args"], message },
      ])
    })

    it("checks the number of arguments of an aggregate with an optional one", () => {
      expect(aggregate(fn("count")).data).toEqual({ type: "integer" })
      expect(
        messages(aggregate(fn("count", field("qty"), field("qty"))))
      ).toEqual(["count takes at most 1 argument"])
    })

    it("takes at most 15 values in in", () => {
      const values = Array.from({ length: 15 }, (_, index) => value(index))
      expect(row(fn("in", field("qty"), ...values)).data).toEqual({
        type: "boolean",
      })
      expect(
        messages(row(fn("in", field("qty"), ...values, value(15))))
      ).toEqual(["in takes at most 16 arguments"])
    })

    it("requires constant arguments to be literals", () => {
      expect(issues(row(fn("round", field("score"), field("qty"))))).toEqual([
        {
          code: "custom",
          path: ["args", 1],
          message: "Must be a constant value",
        },
      ])
    })

    it("checks the range of a constant", () => {
      expect(messages(row(fn("round", field("score"), value(11))))).toEqual([
        "Must be a number from 0 to 10",
      ])
      expect(
        messages(aggregate(fn("percentile", field("score"), value(1.5))))
      ).toEqual(["Must be a number from 0 to 1"])
      expect(messages(row(fn("round", field("score"), value(null))))).toEqual([
        "Must be a number from 0 to 10",
      ])
      expect(messages(row(fn("round", field("score"), value(2.5))))).toEqual([
        "Must be an integer, not number",
      ])
    })

    it("checks the strings an argument can take", () => {
      expect(
        row(fn("dateDiff", field("placed"), field("shipped"), value("days")))
          .data
      ).toEqual({ type: "integer" })
      expect(
        messages(
          row(fn("dateDiff", field("placed"), field("shipped"), value("hours")))
        )
      ).toEqual(['Must be "days", "weeks", "months" or "years"'])
      expect(
        messages(
          row(fn("dateDiff", field("placed"), field("shipped"), field("name")))
        )
      ).toEqual(['Must be "days", "weeks", "months" or "years"'])
      expect(messages(row(fn("rank", field("score"), value("up"))))).toEqual([
        'Must be "desc" or "asc"',
      ])
    })

    it("reports every failing argument", () => {
      expect(
        issues(row(fn("and", field("name"), field("missing"), field("qty"))))
      ).toEqual([
        {
          code: "custom",
          path: ["args", 1, "field"],
          message: "Unknown field missing",
        },
        {
          code: "custom",
          path: ["args", 0],
          message: "Must be a boolean, not string",
        },
        {
          code: "custom",
          path: ["args", 2],
          message: "Must be a boolean, not integer",
        },
      ])
    })
  })

  describe("argument types", () => {
    it("accepts an integer wherever a number is", () => {
      expect(row(fn("div", field("qty"), value(2))).data).toEqual({
        type: "number",
      })
    })

    it("rejects a number where an integer is required", () => {
      expect(messages(row(fn("left", field("name"), field("score"))))).toEqual([
        "Must be an integer, not number",
      ])
    })

    it("lists the accepted types", () => {
      expect(messages(row(fn("gt", field("active"), field("active"))))).toEqual(
        [
          "Must be a number, string, date or datetime, not boolean",
          "Must be a number, string, date or datetime, not boolean",
        ]
      )
    })

    it("unifies integer with number and date with datetime", () => {
      expect(row(fn("min2", field("qty"), field("score"))).data).toEqual({
        type: "number",
      })
      expect(row(fn("max2", field("placed"), field("shipped"))).data).toEqual({
        type: "datetime",
      })
    })

    it("rejects arguments of one group with different types", () => {
      expect(issues(row(fn("eq", field("qty"), field("name"))))).toEqual([
        {
          code: "custom",
          path: ["args", 1],
          message: "Must be an integer to match argument 1, not string",
        },
      ])
    })

    it("unifies every value of a variadic group", () => {
      expect(
        row(fn("coalesce", field("qty"), value(null), value(1.5))).data
      ).toEqual({ type: "number" })
      expect(
        messages(row(fn("in", field("region"), value("north"), value(3))))
      ).toEqual(["Must be a string to match argument 1, not integer"])
    })

    it("reads a string literal as a date where one is expected", () => {
      expect(row(fn("addDays", value("2024-02-29"), value(1))).data).toEqual({
        type: "date",
      })
      expect(
        row(fn("addDays", value("2024-02-29T10:00:00.000+05:30"), value(1)))
          .data
      ).toEqual({ type: "datetime" })
      expect(row(fn("gt", field("placed"), value("2024-01-01"))).data).toEqual({
        type: "boolean",
      })
      expect(
        row(fn("min2", value("2024-01-01"), field("placed"))).data
      ).toEqual({ type: "date" })
      expect(
        row(fn("max2", field("placed"), value("2024-01-01T00:00:00Z"))).data
      ).toEqual({ type: "datetime" })
    })

    it.each([
      "2023-02-29",
      "2024-13-01",
      "24-01-01",
      "2024-01-01T10:00Z",
      "2024-01-01T10:00:00",
      "2024-01-01T24:00:00Z",
      "2024-01-01T10:00:00.5Z",
      "2024-01-01 10:00:00Z",
    ])("rejects %s where a date is expected", (text) => {
      expect(messages(row(fn("gt", field("shipped"), value(text))))).toEqual([
        "Must be a date as YYYY-MM-DD or a datetime as ISO 8601 with seconds and an offset to match argument 1",
      ])
      expect(messages(row(fn("age", value(text))))).toEqual([
        "Must be a date as YYYY-MM-DD or a datetime as ISO 8601 with seconds and an offset",
      ])
    })

    it("keeps a string literal a string next to strings", () => {
      expect(
        row(fn("if", field("active"), value("2024-01-01"), field("name"))).data
      ).toEqual({ type: "string" })
      expect(
        row(fn("coalesce", value("2024-01-01"), value("later"))).data
      ).toEqual({ type: "string" })
    })

    it("rejects a string literal next to a number", () => {
      expect(messages(row(fn("add", field("qty"), value("1"))))).toEqual([
        "Must be a number, not string",
      ])
      expect(messages(row(fn("eq", field("qty"), value("1"))))).toEqual([
        "Must be an integer to match argument 1, not string",
      ])
    })
  })

  describe("null literals", () => {
    it("fit any argument", () => {
      expect(row(fn("add", field("price"), value(null))).data).toEqual({
        type: "number",
        unit: "USD",
      })
      expect(row(fn("concat", value(null), field("name"))).data).toEqual({
        type: "string",
      })
      expect(row(fn("isNull", value(null))).data).toEqual({ type: "boolean" })
    })

    it("give a group of only nulls the null type", () => {
      expect(row(fn("add", value(null), value(null))).data).toEqual({
        type: "null",
      })
      expect(
        row(fn("if", field("active"), value(null), value(null))).data
      ).toEqual({ type: "null" })
      expect(row(fn("mul", value(null), value(null))).data).toEqual({
        type: "null",
      })
    })

    it("take the type of the rest of their group", () => {
      expect(
        row(fn("if", field("active"), value(null), field("placed"))).data
      ).toEqual({ type: "date" })
      expect(row(fn("coalesce", value(null), field("price"))).data).toEqual({
        type: "number",
        unit: "USD",
      })
    })
  })

  describe("return forms", () => {
    it("returns a fixed type", () => {
      expect(row(fn("length", field("name"))).data).toEqual({ type: "integer" })
      expect(row(fn("today")).data).toEqual({ type: "date" })
      expect(row(fn("floor", field("price"))).data).toEqual({
        type: "integer",
        unit: "USD",
      })
    })

    it("returns the type of an argument's group", () => {
      expect(row(fn("abs", field("qty"))).data).toEqual({ type: "integer" })
      expect(row(fn("add", field("qty"), value(1.5))).data).toEqual({
        type: "number",
      })
      expect(row(fn("addDays", field("shipped"), value(1))).data).toEqual({
        type: "datetime",
      })
      expect(aggregate(fn("first", field("name"))).data).toEqual({
        type: "string",
      })
    })

    it("joins the types of mul's arguments", () => {
      expect(row(fn("mul", field("qty"), value(2))).data).toEqual({
        type: "integer",
      })
      expect(row(fn("mul", field("qty"), value(0.5))).data).toEqual({
        type: "number",
      })
      expect(row(fn("mul", value(null), field("qty"))).data).toEqual({
        type: "integer",
      })
    })

    it("returns an integer from round only when digits is 0", () => {
      expect(row(fn("round", field("score"))).data).toEqual({ type: "integer" })
      expect(row(fn("round", field("score"), value(0))).data).toEqual({
        type: "integer",
      })
      expect(row(fn("round", field("price"), value(2))).data).toEqual({
        type: "number",
        unit: "USD",
      })
    })
  })

  describe("units", () => {
    it("keeps the unit of a group", () => {
      expect(row(fn("add", field("price"), field("cost"))).data).toEqual({
        type: "number",
        unit: "USD",
      })
      expect(row(fn("sub", value(10), field("price"))).data).toEqual({
        type: "number",
        unit: "USD",
      })
      expect(
        row(fn("clamp", field("score"), value(0), field("weight"))).data
      ).toEqual({ type: "number", unit: "kg" })
    })

    it("rejects different units in one group", () => {
      expect(issues(row(fn("add", field("price"), field("fee"))))).toEqual([
        {
          code: "custom",
          path: ["args", 1],
          message: "Must be in USD to match argument 1, not EUR",
        },
      ])
      expect(
        messages(row(fn("between", field("weight"), value(1), field("price"))))
      ).toEqual(["Must be in kg to match argument 1, not USD"])
      expect(
        messages(row(fn("gt", field("discount"), field("price"))))
      ).toEqual(["Must be in percent to match argument 1, not USD"])
    })

    it.each([
      ["price", "qty", "USD"],
      ["qty", "price", "USD"],
      ["discount", "price", "USD"],
      ["price", "discount", "USD"],
      ["discount", "margin", "percent"],
      ["discount", "qty", "percent"],
      ["qty", "score", undefined],
    ])("multiplies %s by %s", (a, b, unit) => {
      expect(row(fn("mul", field(a), field(b))).data?.unit).toBe(unit)
    })

    it.each([
      ["price", "fee"],
      ["price", "cost"],
      ["weight", "price"],
    ])("can't multiply %s by %s", (a, b) => {
      const [unitA, unitB] = [a, b].map(
        (id) => fields[id]?.unit ?? fields[id]?.currency
      )
      expect(issues(row(fn("mul", field(a), field(b))))).toEqual([
        {
          code: "custom",
          path: [],
          message: `Can't multiply ${String(unitA)} by ${String(unitB)}`,
        },
      ])
    })

    it.each([
      ["price", "cost", undefined],
      ["discount", "margin", undefined],
      ["price", "qty", "USD"],
      ["price", "discount", "USD"],
      ["discount", "qty", "percent"],
      ["qty", "discount", undefined],
      ["qty", "score", undefined],
    ])("divides %s by %s", (a, b, unit) => {
      expect(row(fn("div", field(a), field(b))).data).toEqual(
        unit === undefined ? { type: "number" } : { type: "number", unit }
      )
    })

    it("can't divide by a different unit", () => {
      expect(messages(row(fn("div", field("price"), field("fee"))))).toEqual([
        "Can't divide USD by EUR",
      ])
      expect(messages(row(fn("div", field("qty"), field("price"))))).toEqual([
        "Can't divide a number without a unit by USD",
      ])
      expect(
        messages(row(fn("div", field("discount"), field("price"))))
      ).toEqual(["Can't divide percent by USD"])
    })

    it("gives the catalog's fixed units", () => {
      expect(
        row(fn("percentChange", field("cost"), field("price"))).data
      ).toEqual({ type: "number", unit: "percent" })
      expect(row(fn("share", field("price"))).data).toEqual({
        type: "number",
        unit: "percent",
      })
      expect(aggregate(fn("variance", field("price"))).data).toEqual({
        type: "number",
      })
      expect(aggregate(fn("stddev", field("price"))).data).toEqual({
        type: "number",
        unit: "USD",
      })
      expect(aggregate(fn("count", field("price"))).data).toEqual({
        type: "integer",
      })
      expect(row(fn("rank", field("price"))).data).toEqual({ type: "integer" })
    })

    it("gives units only to numbers", () => {
      expect(
        row(fn("if", field("active"), field("price"), value(0))).data
      ).toEqual({ type: "number", unit: "USD" })
      expect(aggregate(fn("max", field("placed"))).data).toEqual({
        type: "date",
      })
    })
  })

  describe("aggregate and window nesting", () => {
    it("lets row functions combine aggregates", () => {
      expect(
        aggregate(fn("div", fn("sum", field("price")), fn("sum", field("qty"))))
          .data
      ).toEqual({ type: "number", unit: "USD" })
      expect(
        aggregate(fn("mul", fn("mean", field("score")), value(2))).data
      ).toEqual({ type: "number" })
    })

    it("lets aggregate functions take row expressions", () => {
      expect(
        aggregate(
          fn("sumIf", field("price"), fn("eq", field("region"), value("north")))
        ).data
      ).toEqual({ type: "number", unit: "USD" })
    })

    it("rejects an aggregate function in a row expression", () => {
      expect(
        issues(row(fn("add", field("qty"), fn("sum", field("qty")))))
      ).toEqual([
        {
          code: "custom",
          path: ["args", 1, "fn"],
          message:
            "sum is an aggregate function, which a row expression can't use",
        },
      ])
    })

    it("rejects a field outside an aggregate function in an aggregate expression", () => {
      expect(
        issues(aggregate(fn("sub", fn("sum", field("price")), field("cost"))))
      ).toEqual([
        {
          code: "custom",
          path: ["args", 1, "field"],
          message:
            "cost must be inside an aggregate function in an aggregate expression",
        },
      ])
    })

    it("rejects an aggregate function nested in another", () => {
      expect(
        issues(aggregate(fn("max", fn("abs", fn("sum", field("qty"))))))
      ).toEqual([
        {
          code: "custom",
          path: ["args", 0, "args", 0, "fn"],
          message: "sum is an aggregate function, which can't be nested in max",
        },
      ])
    })

    it("rejects a window function in an aggregate function", () => {
      expect(
        messages(aggregate(fn("sum", fn("share", field("price")))))
      ).toEqual(["share is a window function, which can't be nested in sum"])
    })

    it("rejects functions nested in a window function", () => {
      expect(messages(row(fn("rank", fn("rank", field("qty")))))).toEqual([
        "rank is a window function, which can't be nested in rank",
      ])
      expect(messages(row(fn("runningSum", fn("sum", field("qty")))))).toEqual([
        "sum is an aggregate function, which can't be nested in runningSum",
      ])
    })

    it("allows window functions in row expressions", () => {
      expect(
        row(fn("lte", fn("rank", field("price"), value("asc")), value(3))).data
      ).toEqual({ type: "boolean" })
    })

    it("rejects a window function in an aggregate expression", () => {
      expect(messages(aggregate(fn("zScore", field("score"))))).toEqual([
        "zScore is a window function, which an aggregate expression can't use",
      ])
    })

    it("accepts constants in an aggregate expression", () => {
      expect(aggregate(value(1)).data).toEqual({ type: "integer" })
    })
  })
})
