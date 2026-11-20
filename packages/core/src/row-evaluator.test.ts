import { describe, expect, it, vi } from "vitest"

import type { Expression } from "@pliantui/contract"

import type { ExpressionField } from "./check-expression"
import { createRowEvaluator, type RowEvaluatorOptions } from "./row-evaluator"

const fields: Record<string, ExpressionField> = {
  name: { type: "string" },
  code: { type: "id" },
  score: { type: "number" },
  qty: { type: "integer" },
  price: { type: "currency", currency: "USD" },
  discount: { type: "percent" },
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

function evaluatorFor(options: Partial<RowEvaluatorOptions> = {}) {
  return createRowEvaluator({ fields, timeZone: "Asia/Kolkata", ...options })
}

function evaluate(
  expression: Expression,
  row: object = {},
  options: Partial<RowEvaluatorOptions> = {}
) {
  const result = evaluatorFor(options)(expression)
  if (!result.success) {
    throw result.error
  }
  return result.data(row)
}

function messages(
  expression: Expression,
  options: Partial<RowEvaluatorOptions> = {}
) {
  return evaluatorFor(options)(expression).error?.issues.map(
    ({ path, message }) => ({ path, message })
  )
}

describe("createRowEvaluator", () => {
  describe("fields", () => {
    it.each([
      ["name", "Ada", "Ada"],
      ["code", "A-1", "A-1"],
      ["score", 2.5, 2.5],
      ["qty", 3, 3],
      ["price", 19.99, 19.99],
      ["discount", 0.15, 0.15],
      ["active", false, false],
      ["placed", "2024-02-29", "2024-02-29"],
      ["shipped", "2024-02-29T10:15:30.250Z", "2024-02-29T10:15:30.250Z"],
    ])("reads %s", (id, input, expected) => {
      expect(evaluate(field(id), { [id]: input })).toBe(expected)
    })

    it.each([
      ["name", 42],
      ["code", 7],
      ["score", "2.5"],
      ["score", Number.NaN],
      ["score", Number.POSITIVE_INFINITY],
      ["qty", 2.5],
      ["active", "true"],
      ["active", 1],
      ["placed", "2023-02-29"],
      ["placed", "2024-13-01"],
      ["placed", "29/02/2024"],
      ["placed", 1_709_164_800_000],
      ["shipped", "2024-02-29T24:00:00Z"],
      ["shipped", "2024-02-29T10:60:00Z"],
      ["shipped", "2024-02-29T10:00:00+24:00"],
      ["shipped", "2024-02-29T10:00Z"],
      ["shipped", 1_709_164_800_000],
      ["shipped", new Date(Number.NaN)],
      ["placed", new Date(Number.NaN)],
    ])("reads %s = %j, which doesn't fit its type, as null", (id, input) => {
      expect(evaluate(field(id), { [id]: input })).toBeNull()
    })

    it("reads a missing or null field as null", () => {
      expect(evaluate(field("score"), {})).toBeNull()
      expect(evaluate(field("score"), { score: null })).toBeNull()
    })

    it("reads a Date in a datetime field as its instant", () => {
      expect(
        evaluate(field("shipped"), {
          shipped: new Date("2024-01-01T23:30:00.250Z"),
        })
      ).toBe("2024-01-01T23:30:00.250Z")
    })

    it("reads a Date in a date field as its UTC calendar date", () => {
      // Database drivers return a date column as midnight UTC of that date.
      expect(
        evaluate(field("placed"), { placed: new Date("2024-01-01T00:00:00Z") })
      ).toBe("2024-01-01")
      expect(
        evaluate(field("placed"), { placed: new Date("2024-01-01T23:30:00Z") })
      ).toBe("2024-01-01")
    })

    it("reads a Date from another realm, but not an object posing as one", () => {
      // A Date made with another prototype, as one from an iframe has.
      const foreign: unknown = Reflect.construct(
        Date,
        ["2024-01-01T10:00:00Z"],
        Object
      )
      expect(foreign instanceof Date).toBe(false)
      expect(evaluate(field("shipped"), { shipped: foreign })).toBe(
        "2024-01-01T10:00:00.000Z"
      )
      const posing = { [Symbol.toStringTag]: "Date" }
      expect(evaluate(field("shipped"), { shipped: posing })).toBeNull()
      const proxy = new Proxy(new Date(), {})
      expect(evaluate(field("shipped"), { shipped: proxy })).toBeNull()
    })

    it.each([
      ["2024-01-01T10:00:00z", "2024-01-01T10:00:00.000Z"],
      ["2024-01-01T10:00:00+0530", "2024-01-01T04:30:00.000Z"],
      ["2024-01-01T10:00:00-05", "2024-01-01T15:00:00.000Z"],
      ["2024-01-01T10:00:00+00", "2024-01-01T10:00:00.000Z"],
    ])("reads the offset of %s", (shipped, expected) => {
      expect(evaluate(field("shipped"), { shipped })).toBe(expected)
    })

    it.each([
      "2024-01-01T10:00:00+05:",
      "2024-01-01T10:00:00+5",
      "2024-01-01T10:00:00+05300",
    ])("reads %s, whose offset is malformed, as null", (shipped) => {
      expect(evaluate(field("shipped"), { shipped })).toBeNull()
    })

    it("reads inherited properties and getters, as TanStack's accessorKey does", () => {
      class Order {
        readonly qty = 2
        get score() {
          return this.qty * 1.5
        }
      }
      expect(evaluate(field("score"), new Order())).toBe(3)
      expect(
        evaluate(field("score"), Object.create({ score: 4 }) as object)
      ).toBe(4)
    })

    it("reads what every object inherits as null", () => {
      const options = {
        fields: { ...fields, constructor: { type: "string" as const } },
      }
      expect(evaluate(field("constructor"), {}, options)).toBeNull()
      expect(
        evaluate(field("constructor"), { constructor: "own" }, options)
      ).toBe("own")
    })

    it("reads values through getValue", () => {
      const getValue = (row: { data: Record<string, unknown> }, id: string) =>
        row.data[id]
      const result = createRowEvaluator({
        fields,
        timeZone: "UTC",
        getValue,
      })(fn("mul", field("price"), field("qty")))
      expect(result.data?.({ data: { price: 2.5, qty: 4 } })).toBe(10)
    })

    it("reads a bigint, a decimal object or a numeric string as null", () => {
      expect(evaluate(field("qty"), { qty: 3n })).toBeNull()
      expect(
        evaluate(field("price"), { price: { toString: () => "1.5" } })
      ).toBeNull()
      expect(evaluate(field("price"), { price: "1.5" })).toBeNull()
    })

    it("reads -0 as 0", () => {
      expect(Object.is(evaluate(field("score"), { score: -0 }), 0)).toBe(true)
    })

    it("cuts a datetime's fraction of a second to milliseconds", () => {
      expect(
        evaluate(field("shipped"), { shipped: "2024-01-01T00:00:00.123987Z" })
      ).toBe("2024-01-01T00:00:00.123Z")
    })

    it("reads a datetime without an offset in the dataset's time zone", () => {
      expect(
        evaluate(field("shipped"), { shipped: "2024-01-01T09:00:00" })
      ).toBe("2024-01-01T03:30:00.000Z")
    })

    it("reads a date in a datetime field as the start of that day", () => {
      expect(evaluate(field("shipped"), { shipped: "2024-01-01" })).toBe(
        "2023-12-31T18:30:00.000Z"
      )
    })

    it("reads a datetime with an offset in a date field as its date in the dataset's time zone", () => {
      expect(
        evaluate(field("placed"), { placed: "2024-01-01T20:00:00Z" })
      ).toBe("2024-01-02")
      expect(evaluate(field("placed"), { placed: "2024-01-01T20:00:00" })).toBe(
        "2024-01-01"
      )
    })

    it("reads years before the common era", () => {
      expect(evaluate(field("placed"), { placed: "0000-02-29" })).toBe(
        "0000-02-29"
      )
      expect(
        evaluate(field("placed"), { placed: "0000-02-29T23:00:00Z" })
      ).toBe("0000-03-01")
    })
  })

  describe("values", () => {
    it.each([
      ["2024-01-01", "2024-01-01"],
      [2, 2],
      [2.5, 2.5],
      [true, true],
    ])("returns the literal %j", (literal, expected) => {
      expect(evaluate(value(literal))).toBe(expected)
    })

    it("reads a string literal as a date where a date is expected", () => {
      expect(
        evaluate(fn("eq", field("placed"), value("2024-03-01")), {
          placed: "2024-03-01",
        })
      ).toBe(true)
      expect(evaluate(fn("addDays", value("2024-02-28"), value(1)))).toBe(
        "2024-02-29"
      )
    })

    it("reads a string literal as text where text is expected", () => {
      expect(
        evaluate(fn("eq", field("name"), value("2024-03-01")), {
          name: "2024-03-01",
        })
      ).toBe(true)
    })

    it("reads a date as the start of its day in the dataset's time zone where a datetime is expected", () => {
      const sameMoment = fn("eq", field("placed"), field("shipped"))
      expect(
        evaluate(sameMoment, {
          placed: "2024-03-01",
          shipped: "2024-02-29T18:30:00Z",
        })
      ).toBe(true)
      expect(
        evaluate(sameMoment, {
          placed: "2024-03-01",
          shipped: "2024-03-01T00:00:00Z",
        })
      ).toBe(false)
      expect(
        evaluate(fn("gt", field("shipped"), value("2024-03-01")), {
          shipped: "2024-02-29T18:30:00.001Z",
        })
      ).toBe(true)
    })

    it("returns a date or datetime written as text", () => {
      expect(
        evaluate(fn("coalesce", field("placed"), value("2024-01-05")))
      ).toBe("2024-01-05")
      expect(
        evaluate(fn("coalesce", field("shipped"), value("2024-01-05")))
      ).toBe("2024-01-04T18:30:00.000Z")
      expect(
        evaluate(
          fn("coalesce", field("shipped"), value("2024-01-05T10:00:00+05:30"))
        )
      ).toBe("2024-01-05T04:30:00.000Z")
    })
  })

  describe("refs", () => {
    const derived = {
      total: fn("mul", field("price"), field("qty")),
      net: fn("sub", ref("total"), fn("mul", ref("total"), field("discount"))),
      due: fn("addDays", field("placed"), value(30)),
    }

    it("computes derived fields", () => {
      expect(
        evaluate(ref("net"), { price: 10, qty: 3, discount: 0.5 }, { derived })
      ).toBe(15)
      expect(
        evaluate(
          fn("gt", ref("due"), value("2024-03-01")),
          {
            placed: "2024-02-01",
          },
          { derived }
        )
      ).toBe(true)
    })

    it("computes each derived field once per row", () => {
      let reads = 0
      const row = {
        get price() {
          reads++
          return 2
        },
        qty: 3,
        discount: 0,
      }
      expect(
        evaluate(fn("add", ref("net"), ref("total")), row, { derived })
      ).toBe(12)
      expect(reads).toBe(1)
    })

    it("follows a long chain of refs without overflowing the stack", () => {
      const chain: Record<string, Expression> = { d0: field("score") }
      for (let index = 1; index <= 20_000; index++) {
        chain[`d${String(index)}`] = fn(
          "add",
          ref(`d${String(index - 1)}`),
          value(1)
        )
      }
      expect(evaluate(ref("d20000"), { score: 0.5 }, { derived: chain })).toBe(
        20_000.5
      )
    })

    it("computes refs shared in a diamond once each", () => {
      const diamond: Record<string, Expression> = { d0: field("qty") }
      for (let index = 1; index <= 60; index++) {
        const previous = ref(`d${String(index - 1)}`)
        diamond[`d${String(index)}`] = fn("max2", previous, previous)
      }
      let reads = 0
      const row = {
        get qty() {
          reads++
          return 7
        },
      }
      expect(evaluate(ref("d60"), row, { derived: diamond })).toBe(7)
      expect(reads).toBe(1)
    })
  })

  describe("issues", () => {
    it("reports what the checker reports", () => {
      expect(messages(fn("add", field("name"), value(1)))).toEqual([
        { path: ["args", 0], message: "Must be a number, not string" },
      ])
      expect(messages(fn("sum", field("score")))).toEqual([
        {
          path: ["fn"],
          message:
            "sum is an aggregate function, which a row expression can't use",
        },
      ])
    })

    it("rejects window functions, which need every row of their partition", () => {
      expect(messages(fn("add", fn("rank", field("score")), value(1)))).toEqual(
        [
          {
            path: ["args", 0, "fn"],
            message:
              "rank is a window function, which needs every row of its partition",
          },
        ]
      )
    })

    it("rejects refs to derived fields that use window functions", () => {
      const derived = {
        top: fn("lte", fn("rank", field("score")), value(3)),
        flagged: fn("and", ref("top"), field("active")),
        plain: fn("not", field("active")),
      }
      expect(
        messages(fn("or", ref("plain"), ref("flagged")), { derived })
      ).toEqual([
        {
          path: ["args", 1, "ref"],
          message:
            "flagged uses a window function, which needs every row of its partition",
        },
      ])
    })
  })

  describe("null semantics", () => {
    it("gives null when an argument of a propagating function is null", () => {
      expect(evaluate(fn("add", field("score"), value(1)))).toBeNull()
      expect(evaluate(fn("upper", field("name")))).toBeNull()
      expect(
        evaluate(fn("eq", field("name"), value(null)), { name: "a" })
      ).toBeNull()
    })

    it("computes a NaN or infinite result as null", () => {
      expect(
        evaluate(fn("mul", field("score"), field("score")), { score: 1e300 })
      ).toBeNull()
      expect(
        evaluate(fn("sub", fn("mul", field("score"), value(10)), value(1)), {
          score: Number.MAX_VALUE,
        })
      ).toBeNull()
    })
  })

  describe("today", () => {
    // 2024-03-10T20:00:00Z is March 11 in Kolkata and March 10 in New York.
    const now = () => Date.parse("2024-03-10T20:00:00Z")

    it("reads the current date from the clock in the dataset's time zone", () => {
      expect(evaluate(fn("today"), {}, { now })).toBe("2024-03-11")
    })

    it("reads the clock for every row", () => {
      let time = Date.parse("2024-03-10T12:00:00Z")
      const result = evaluatorFor({ now: () => time })(fn("today"))
      expect(result.data?.({})).toBe("2024-03-10")
      time += 12 * 3_600_000
      expect(result.data?.({})).toBe("2024-03-11")
      time -= 12 * 3_600_000
      expect(result.data?.({})).toBe("2024-03-10")
    })

    it("converts the clock to a date once for rows read at the same time", () => {
      const result = evaluatorFor({ now })(fn("age", value("2000-01-01")))
      const formatToParts = vi.spyOn(
        Intl.DateTimeFormat.prototype,
        "formatToParts"
      )
      try {
        for (let index = 0; index < 1000; index++) {
          expect(result.data?.({})).toBe(24)
        }
        expect(formatToParts.mock.calls.length).toBeLessThanOrEqual(1)
      } finally {
        formatToParts.mockRestore()
      }
    })

    it("gives null for today when the clock reads outside the years 0000 to 9999", () => {
      expect(evaluate(fn("today"), {}, { now: () => 1e16 })).toBeNull()
      expect(
        evaluate(fn("age", value("2000-01-01")), {}, { now: () => Number.NaN })
      ).toBeNull()
    })

    it("reads the current date in the zone given for the expression", () => {
      const result = evaluatorFor({ now })(fn("today"), {
        todayTimeZone: "America/New_York",
      })
      expect(result.data?.({})).toBe("2024-03-10")
    })

    it("reads the current date in the zone given for each derived field", () => {
      const derived = { viewerToday: fn("today"), datasetToday: fn("today") }
      const evaluator = evaluatorFor({
        now,
        derived,
        todayTimeZones: { viewerToday: "America/New_York" },
      })
      const days = fn(
        "dateDiff",
        ref("viewerToday"),
        ref("datasetToday"),
        value("days")
      )
      expect(evaluator(days).data?.({})).toBe(1)
    })

    it("throws for an unknown time zone", () => {
      expect(() => evaluatorFor({ timeZone: "Mars/Olympus" })).toThrow(
        RangeError
      )
      expect(() =>
        evaluatorFor({ todayTimeZones: { unused: "Mars/Olympus" } })
      ).toThrow(RangeError)
    })

    it("fails an expression given an unknown time zone", () => {
      const result = evaluatorFor()(fn("today"), {
        todayTimeZone: "Mars/Olympus",
      })
      expect(result.error?.issues).toEqual([
        { code: "custom", path: [], message: "Unknown time zone Mars/Olympus" },
      ])
    })
  })
})
