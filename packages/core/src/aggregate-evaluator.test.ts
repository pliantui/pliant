import { describe, expect, it, vi } from "vitest"

import type { Expression } from "@pliantui/contract"

import {
  createAggregateEvaluator,
  type AggregateEvaluatorOptions,
} from "./aggregate-evaluator"
import type { ExpressionField } from "./check-expression"
import { scaleBy } from "./scale"

// Stryker reruns every test that covers a mutant, so under mutation testing
// (PLIANT_MUTATION, set by stryker.config.mjs) the tests that read many
// millions of rows are skipped and the generated data is smaller.
const mutating = process.env["PLIANT_MUTATION"] === "1"

const fields: Record<string, ExpressionField> = {
  name: { type: "string" },
  region: { type: "enum" },
  score: { type: "number" },
  qty: { type: "integer" },
  price: { type: "currency", currency: "USD" },
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

type Options = Partial<AggregateEvaluatorOptions>

function evaluatorFor(options: Options = {}) {
  return createAggregateEvaluator({
    fields,
    timeZone: "Asia/Kolkata",
    ...options,
  })
}

function prepare(expression: Expression, options: Options = {}) {
  const result = evaluatorFor(options)(expression)
  if (!result.success) {
    throw result.error
  }
  return result.data
}

function aggregate(
  expression: Expression,
  rows: Iterable<object>,
  options: Options = {}
) {
  return prepare(expression, options).aggregate(rows)
}

function messages(expression: Expression, options: Options = {}) {
  return evaluatorFor(options)(expression).error?.issues.map(
    ({ path, message }) => ({ path, message })
  )
}

const scores = (...values: unknown[]) => values.map((score) => ({ score }))

describe("createAggregateEvaluator", () => {
  describe("counts", () => {
    const rows = [
      { score: 1, active: true },
      { score: null, active: false },
      { score: 3, active: null },
      { active: true },
    ]

    it("counts every row with count()", () => {
      expect(aggregate(fn("count"), rows)).toBe(4)
    })

    it("counts the rows where x isn't null with count(x)", () => {
      expect(aggregate(fn("count", field("score")), rows)).toBe(2)
    })

    it("counts the rows where the condition is true with countIf", () => {
      expect(aggregate(fn("countIf", field("active")), rows)).toBe(2)
    })

    it("counts distinct values, leaving out nulls", () => {
      expect(
        aggregate(fn("distinctCount", field("name")), [
          { name: "a" },
          { name: "b" },
          { name: "a" },
          { name: null },
          {},
        ])
      ).toBe(2)
    })

    it("counts 0 over no rows", () => {
      expect(aggregate(fn("count"), [])).toBe(0)
      expect(aggregate(fn("countIf", field("active")), [])).toBe(0)
      expect(aggregate(fn("distinctCount", field("name")), [])).toBe(0)
    })
  })

  describe("sums and means", () => {
    it("sums x, leaving out nulls", () => {
      expect(aggregate(fn("sum", field("score")), scores(1.5, null, 2))).toBe(
        3.5
      )
    })

    it("sums to 0 over no values", () => {
      expect(aggregate(fn("sum", field("score")), scores(null))).toBe(0)
      expect(aggregate(fn("sum", field("score")), [])).toBe(0)
    })

    it("sums x over the rows where the condition is true with sumIf", () => {
      const rows = [
        { score: 1, active: true },
        { score: 2, active: false },
        { score: 4, active: null },
        { score: null, active: true },
        { score: 8, active: true },
      ]
      expect(
        aggregate(fn("sumIf", field("score"), field("active")), rows)
      ).toBe(9)
      expect(aggregate(fn("sumIf", field("score"), field("active")), [])).toBe(
        0
      )
    })

    it("averages x, leaving out nulls, or gives null without values", () => {
      expect(aggregate(fn("mean", field("score")), scores(1, null, 2))).toBe(
        1.5
      )
      expect(aggregate(fn("mean", field("score")), scores(null))).toBeNull()
    })

    it("keeps small values that a larger one later cancels", () => {
      expect(
        aggregate(fn("sum", field("score")), scores(1, 1e100, 1, -1e100))
      ).toBe(2)
    })

    it("keeps a sum whose partial sums overflow but whose result fits", () => {
      const max = Number.MAX_VALUE
      const sum = (...values: number[]) =>
        aggregate(fn("sum", field("score")), scores(...values))
      expect(sum(max, max, -max)).toBe(max)
      expect(sum(1e308, 1e308, -1e308)).toBe(1e308)
      expect(sum(-max, -max, max)).toBe(-max)
      expect(sum(max, -max, 1)).toBe(1)
      expect(
        aggregate(
          fn("sumIf", field("score"), field("active")),
          [max, max, -max].map((score) => ({ score, active: true }))
        )
      ).toBe(max)
    })

    it("averages values whose deviations overflow", () => {
      const max = Number.MAX_VALUE
      const mean = (...values: number[]) =>
        aggregate(fn("mean", field("score")), scores(...values))
      expect(mean(1e308, -1e308)).toBe(0)
      expect(mean(max, max)).toBe(max)
      expect(mean(max, -max, max, -max)).toBe(0)
      expect(mean(-max, max, 1e308)).toBeCloseTo(1e308 / 3, -300)
    })

    it("gives null for a sum that overflows", () => {
      expect(
        aggregate(fn("sum", field("score")), scores(1e308, 1e308))
      ).toBeNull()
    })
  })

  describe("variance", () => {
    const values = scores(2, 4, 4, 4, 5, 5, 7, 9, null)

    it.each([
      ["variance", 32 / 7],
      ["stddev", Math.sqrt(32 / 7)],
      ["variancePop", 4],
      ["stddevPop", 2],
    ])("computes %s", (name, expected) => {
      expect(aggregate(fn(name, field("score")), values)).toBeCloseTo(
        expected,
        12
      )
    })

    it("gives null for the sample variance of fewer than 2 values", () => {
      for (const name of ["variance", "stddev"]) {
        expect(aggregate(fn(name, field("score")), scores(3))).toBeNull()
        expect(aggregate(fn(name, field("score")), [])).toBeNull()
      }
    })

    it("gives null for the population variance of no values", () => {
      for (const name of ["variancePop", "stddevPop"]) {
        expect(aggregate(fn(name, field("score")), scores(3))).toBe(0)
        expect(aggregate(fn(name, field("score")), scores(null))).toBeNull()
      }
    })

    it("gives 0 for equal values at the top of the range", () => {
      const max = Number.MAX_VALUE
      const rows = scores(max, max, max)
      expect(aggregate(fn("variance", field("score")), rows)).toBe(0)
      expect(aggregate(fn("variancePop", field("score")), rows)).toBe(0)
    })

    it("computes deviations whose squares overflow", () => {
      const stddev = (name: string, ...values: number[]) =>
        aggregate(fn(name, field("score")), scores(...values))
      expect(stddev("stddev", 1e308, -1e308)).toBeCloseTo(
        Math.SQRT2 * 1e308,
        -299
      )
      expect(stddev("stddevPop", 1e308, -1e308)).toBeCloseTo(1e308, -299)
      expect(stddev("stddevPop", 1e308, 1e308, 1e308)).toBe(0)
      // The variance of four of these is 1e308, though their squared
      // deviations sum to twice that.
      expect(stddev("variancePop", 1e154, -1e154, 1e154, -1e154)).toBeCloseTo(
        1e308,
        -299
      )
      expect(stddev("variance", 1e308, -1e308)).toBeNull()
    })

    it("computes deviations whose squares underflow", () => {
      const stddev = (name: string, ...values: number[]) =>
        aggregate(fn(name, field("score")), scores(...values))
      expect(stddev("stddev", 1e-200, 3e-200)).toBeCloseTo(
        Math.SQRT2 * 1e-200,
        212
      )
      expect(stddev("stddevPop", 1e-200, 3e-200)).toBeCloseTo(1e-200, 212)
      expect(stddev("variancePop", 1e-200, 3e-200)).toBe(0)
      expect(stddev("mean", 1e-200, 3e-200)).toBeCloseTo(2e-200, 212)
    })

    it("computes statistics of values that grow past each other", () => {
      const values = scores(1, 3, 1e150, -1e150, 2, 1e154, -1e154)
      expect(aggregate(fn("mean", field("score")), values)).toBeCloseTo(0, -140)
      expect(aggregate(fn("stddevPop", field("score")), values)).toBeCloseTo(
        Math.sqrt((2 / 7) * (1 + 1e-8)) * 1e154,
        -143
      )
    })

    it("gives 0 for equal values, however large", () => {
      const rows = scores(...Array.from({ length: 1000 }, () => 1e15 + 0.125))
      expect(aggregate(fn("variance", field("score")), rows)).toBe(0)
      expect(aggregate(fn("mean", field("score")), rows)).toBe(1e15 + 0.125)
    })
  })

  describe("extremes", () => {
    it("picks the smallest and largest number", () => {
      const rows = scores(3, null, -2, 10)
      expect(aggregate(fn("min", field("score")), rows)).toBe(-2)
      expect(aggregate(fn("max", field("score")), rows)).toBe(10)
    })

    it("compares text by code point", () => {
      const rows = [{ name: "b" }, { name: "B" }, { name: "é" }, { name: "z" }]
      expect(aggregate(fn("min", field("name")), rows)).toBe("B")
      expect(aggregate(fn("max", field("name")), rows)).toBe("é")
    })

    it("picks dates and datetimes, returned as text", () => {
      const rows = [
        { placed: "2024-03-01", shipped: "2024-03-01T10:00:00Z" },
        { placed: "2023-12-31", shipped: "2024-03-01T09:59:59.999Z" },
      ]
      expect(aggregate(fn("min", field("placed")), rows)).toBe("2023-12-31")
      expect(aggregate(fn("max", field("placed")), rows)).toBe("2024-03-01")
      expect(aggregate(fn("min", field("shipped")), rows)).toBe(
        "2024-03-01T09:59:59.999Z"
      )
    })

    it("gives null without values", () => {
      expect(aggregate(fn("min", field("score")), scores(null))).toBeNull()
      expect(aggregate(fn("max", field("name")), [])).toBeNull()
    })
  })

  describe("percentiles", () => {
    it("interpolates between the sorted values", () => {
      const rows = scores(40, 10, null, 30, 20)
      const at = (p: number) =>
        aggregate(fn("percentile", field("score"), value(p)), rows)
      expect(at(0)).toBe(10)
      expect(at(1)).toBe(40)
      expect(at(0.5)).toBe(25)
      expect(at(0.25)).toBeCloseTo(17.5, 12)
      expect(at(0.9)).toBeCloseTo(37, 12)
    })

    it("computes the median as the 0.5 percentile", () => {
      expect(aggregate(fn("median", field("score")), scores(3, 1, 2))).toBe(2)
      expect(aggregate(fn("median", field("score")), scores(4, 1, 3, 2))).toBe(
        2.5
      )
    })

    it("sorts negative numbers numerically", () => {
      expect(
        aggregate(fn("median", field("score")), scores(-10, 2, -3, 100, 5))
      ).toBe(2)
    })

    it("doesn't overflow between extreme values", () => {
      expect(
        aggregate(fn("median", field("score")), scores(-1.7e308, 1.7e308))
      ).toBe(0)
    })

    it("gives null without values", () => {
      expect(aggregate(fn("median", field("score")), scores(null))).toBeNull()
      expect(
        aggregate(fn("percentile", field("score"), value(0.9)), [])
      ).toBeNull()
    })
  })

  describe("mode", () => {
    it("picks the most frequent value", () => {
      expect(
        aggregate(fn("mode", field("score")), scores(3, 1, 3, null, null, 2))
      ).toBe(3)
    })

    it("picks the smallest value on a tie, with false before true", () => {
      expect(aggregate(fn("mode", field("score")), scores(3, 2, 3, 2))).toBe(2)
      expect(
        aggregate(fn("mode", field("name")), [{ name: "b" }, { name: "B" }])
      ).toBe("B")
      expect(
        aggregate(fn("mode", field("active")), [
          { active: true },
          { active: false },
        ])
      ).toBe(false)
    })

    it("gives null without values", () => {
      expect(aggregate(fn("mode", field("score")), scores(null))).toBeNull()
    })
  })

  describe("first and last", () => {
    const rows = [
      { name: null },
      { name: "a" },
      { name: "c" },
      { name: "b" },
      { name: null },
    ]

    it("picks the first and last values in the order the rows are given", () => {
      expect(aggregate(fn("first", field("name")), rows)).toBe("a")
      expect(aggregate(fn("last", field("name")), rows)).toBe("b")
    })

    it("gives null without values", () => {
      expect(aggregate(fn("first", field("name")), [{}])).toBeNull()
      expect(aggregate(fn("last", field("name")), [])).toBeNull()
    })
  })

  describe("expressions", () => {
    it("combines aggregates with row functions", () => {
      const rows = [
        { score: 10, qty: 2 },
        { score: 20, qty: 3 },
      ]
      expect(
        aggregate(
          fn("div", fn("sum", field("score")), fn("sum", field("qty"))),
          rows
        )
      ).toBe(6)
    })

    it("evaluates the row expressions that aggregate functions read", () => {
      const rows = [
        { price: 10, qty: 2 },
        { price: 5, qty: null },
        { price: 1, qty: 3 },
      ]
      expect(
        aggregate(fn("sum", fn("mul", field("price"), field("qty"))), rows)
      ).toBe(23)
    })

    it("reads a string literal as a date in a row expression", () => {
      const rows = [{ placed: "2024-01-01" }, { placed: "2024-06-01" }]
      expect(
        aggregate(
          fn("countIf", fn("gt", field("placed"), value("2024-03-01"))),
          rows
        )
      ).toBe(1)
    })

    it("computes with dates that aggregates return", () => {
      const rows = [{ placed: "2024-01-01" }, { placed: "2024-03-01" }]
      expect(
        aggregate(
          fn(
            "dateDiff",
            fn("min", field("placed")),
            fn("max", field("placed")),
            value("days")
          ),
          rows
        )
      ).toBe(60)
    })

    it("reads derived fields in aggregate function arguments, each once per row", () => {
      const getValue = vi.fn((row: object, id: string): unknown =>
        Reflect.get(row, id)
      )
      const rows = [{ score: 1 }, { score: 2 }]
      const expression = fn(
        "add",
        fn("sum", ref("double")),
        fn("max", ref("double"))
      )
      expect(
        aggregate(expression, rows, {
          derived: { double: fn("mul", field("score"), value(2)) },
          getValue,
        })
      ).toBe(10)
      expect(getValue).toHaveBeenCalledTimes(2)
    })

    it("computes aggregates that refs name", () => {
      const rows = scores(1, 2, 3)
      expect(
        aggregate(fn("div", ref("total"), ref("rows")), rows, {
          aggregates: {
            total: fn("sum", field("score")),
            rows: fn("count"),
            unused: fn("max", field("score")),
          },
        })
      ).toBe(2)
    })

    it("computes an aggregate that refs share once per group", () => {
      const rows = scores(1, 2, 3)
      const getValue = vi.fn((row: object, id: string): unknown =>
        Reflect.get(row, id)
      )
      expect(
        aggregate(fn("add", ref("left"), ref("right")), rows, {
          aggregates: {
            left: fn("mul", ref("total"), value(2)),
            right: ref("total"),
            total: fn("sum", field("score")),
          },
          getValue,
        })
      ).toBe(18)
      expect(getValue).toHaveBeenCalledTimes(3)
    })

    it("follows a long chain of aggregate refs without overflowing the stack", () => {
      const aggregates: Record<string, Expression> = {
        a0: fn("sum", field("score")),
      }
      for (let index = 1; index <= 5000; index++) {
        aggregates[`a${String(index)}`] = ref(`a${String(index - 1)}`)
      }
      expect(aggregate(ref("a5000"), scores(1, 2), { aggregates })).toBe(3)
    })

    it("computes a constant expression", () => {
      expect(aggregate(fn("add", value(1), value(2)), [])).toBe(3)
    })

    it("reads rows from any iterable", () => {
      function* rows() {
        yield { score: 1 }
        yield { score: 2 }
      }
      expect(aggregate(fn("sum", field("score")), rows())).toBe(3)
    })

    it("computes each call afresh", () => {
      const { aggregate: run } = prepare(fn("sum", field("score")))
      expect(run(scores(1, 2))).toBe(3)
      expect(run(scores(5))).toBe(5)
    })
  })

  describe("type", () => {
    it("gives the type and unit of the expression's value", () => {
      const { type, unit } = prepare(fn("sum", field("price")))
      expect({ type, unit }).toEqual({ type: "number", unit: "USD" })
      expect(prepare(fn("count")).type).toBe("integer")
      expect(prepare(fn("max", field("placed"))).type).toBe("date")
    })
  })

  describe("issues", () => {
    it("reports what the checker reports", () => {
      expect(messages(field("score"))).toEqual([
        {
          path: ["field"],
          message:
            "score must be inside an aggregate function in an aggregate expression",
        },
      ])
      expect(messages(fn("rank", field("score")))).toEqual([
        {
          path: ["fn"],
          message:
            "rank is a window function, which an aggregate expression can't use",
        },
      ])
    })

    it("throws for an unknown time zone", () => {
      expect(() =>
        evaluatorFor({ aggregateTodayTimeZones: { a: "Mars/Olympus" } })
      ).toThrow(RangeError)
    })

    it("fails an expression given an unknown time zone", () => {
      expect(
        evaluatorFor()(fn("count"), { todayTimeZone: "Mars/Olympus" }).error
          ?.issues[0]?.message
      ).toBe('Unknown time zone "Mars/Olympus"')
    })
  })

  describe("today", () => {
    // 2024-01-01T20:00:00Z: Jan 2 in Kolkata, Jan 1 in New York.
    const now = () => Date.parse("2024-01-01T20:00:00Z")
    const rows = [{ placed: "2024-01-01" }, { placed: "2024-01-02" }]
    const onToday = fn("countIf", fn("eq", field("placed"), fn("today")))

    it("reads the current date in the dataset's time zone", () => {
      expect(aggregate(onToday, rows, { now })).toBe(1)
      expect(
        aggregate(
          fn(
            "dateDiff",
            fn("max", field("placed")),
            fn("today"),
            value("days")
          ),
          rows,
          { now }
        )
      ).toBe(0)
    })

    it("reads the current date in the zone given for the expression", () => {
      const result = evaluatorFor({ now })(
        fn("dateDiff", fn("max", field("placed")), fn("today"), value("days")),
        { todayTimeZone: "America/New_York" }
      )
      expect(result.data?.aggregate(rows)).toBe(-1)
    })

    it("reads the current date in the zone given for each aggregate and derived field", () => {
      const options: Options = {
        now,
        aggregates: {
          lag: fn(
            "dateDiff",
            fn("max", field("placed")),
            fn("today"),
            value("days")
          ),
        },
        derived: { isToday: fn("eq", field("placed"), fn("today")) },
        aggregateTodayTimeZones: { lag: "America/New_York" },
        todayTimeZones: { isToday: "America/New_York" },
      }
      expect(aggregate(ref("lag"), rows, options)).toBe(-1)
      expect(
        aggregate(
          fn("first", fn("if", ref("isToday"), field("placed"), value(null))),
          rows,
          options
        )
      ).toBe("2024-01-01")
    })
  })
})

function random(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One row object, changed for each value, keeps millions of rows light.
function* rowsOf(count: number, valueAt: (index: number) => number) {
  const row = { score: 0 }
  for (let index = 0; index < count; index++) {
    row.score = valueAt(index)
    yield row
  }
}

const view = new DataView(new ArrayBuffer(8))

// A finite double as mantissa × 2^exponent, both exact.
function partsOf(x: number): [bigint, number] {
  view.setFloat64(0, x)
  const bits = view.getBigUint64(0)
  const sign = bits >> 63n === 1n ? -1n : 1n
  const exponent = Number((bits >> 52n) & 0x7ffn)
  const fraction = bits & ((1n << 52n) - 1n)
  return exponent === 0
    ? [sign * fraction, -1074]
    : [sign * (fraction | (1n << 52n)), exponent - 1075]
}

// n × 2^exponent as a double, however large n is.
function ratio(n: bigint, exponent: number) {
  const shift = Math.max(0, n.toString(2).length - 900)
  return scaleBy(Number(n >> BigInt(shift)), exponent + shift)
}

/**
 * The exact sum, mean and variances of the values, computed with integers
 * and rounded once at the end, and the quantities the catalog's allowances
 * are stated in. They're given in units of 2^`unit`, a power of two near the
 * largest magnitude (the sum and mean in those units, and the variances in
 * their squares), so the allowances can't overflow or underflow for huge or
 * tiny values.
 */
function exactOf(values: Float64Array) {
  const parts = Array.from(values, partsOf)
  let low = Infinity
  let largest = 0
  for (const [index, [mantissa, exponent]] of parts.entries()) {
    if (mantissa !== 0n) {
      low = Math.min(low, exponent)
    }
    largest = Math.max(largest, Math.abs(values[index] ?? 0))
  }
  const unit = largest === 0 ? 0 : Math.floor(Math.log2(largest))
  let sum = 0n
  let squares = 0n
  for (const [mantissa, exponent] of parts) {
    const scaled = mantissa << BigInt(exponent - low)
    sum += scaled
    squares += scaled * scaled
  }
  const n = BigInt(values.length)
  const sumUnits = ratio(sum, low - unit)
  const mean = sumUnits / values.length
  const m2 = ratio(n * squares - sum * sum, 2 * (low - unit)) / values.length
  let deviation = 0
  let absolute = 0
  for (const x of values) {
    const inUnits = scaleBy(x, -unit)
    deviation = Math.max(deviation, Math.abs(inUnits - mean))
    absolute += Math.abs(inUnits)
  }
  return {
    unit,
    sum: sumUnits,
    mean,
    variance: m2 / (values.length - 1),
    variancePop: m2 / values.length,
    M: scaleBy(largest, -unit),
    D: deviation,
    A: absolute,
  }
}

function expectWithin(actual: unknown, exact: number, allowance: number) {
  expect(typeof actual).toBe("number")
  expect(Math.abs(Number(actual) - exact)).toBeLessThanOrEqual(allowance)
}

/**
 * Checks each mergeable statistic of the values against the catalog's
 * allowances, in units of 2^`unit` to the `power`, where a result that
 * overflows its range is null.
 */
function expectAccurate(values: Float64Array) {
  const exact = exactOf(values)
  const { M, D, A, unit } = exact
  const of = (name: string) =>
    aggregate(
      fn(name, field("score")),
      rowsOf(values.length, (i) => values[i] ?? 0)
    )
  const expectStatistic = (
    name: string,
    power: number,
    expected: number,
    allowance: number
  ) => {
    const actual = of(name)
    // The statistic is out of range, or too near it for the test to tell.
    if (
      !Number.isFinite(scaleBy(scaleBy(expected, unit), (power - 1) * unit))
    ) {
      expect(actual).toBeNull()
    } else {
      // One subnormal step is added to every allowance: where the result is
      // subnormal, the nearest double can be a whole step from the exact one,
      // which is beyond any relative allowance.
      const step = scaleBy(
        scaleBy(Number.MIN_VALUE, -unit),
        -(power - 1) * unit
      )
      expectWithin(
        typeof actual === "number"
          ? scaleBy(scaleBy(actual, -unit), -(power - 1) * unit)
          : actual,
        expected,
        allowance + step
      )
    }
  }
  expectStatistic("sum", 1, exact.sum, 1e-9 * A)
  expectStatistic("mean", 1, exact.mean, 1e-9 * M)
  const V = 1e-9 * M * (D + 1e-9 * M)
  for (const [name, root, variance] of [
    ["variance", "stddev", exact.variance],
    ["variancePop", "stddevPop", exact.variancePop],
  ] as const) {
    if (name === "variance" && values.length < 2) {
      continue
    }
    expectStatistic(name, 2, variance, V)
    const sigma = Math.sqrt(variance)
    const S = sigma === 0 ? Math.sqrt(V) : Math.min(Math.sqrt(V), V / sigma)
    expectStatistic(root, 1, sigma, S)
  }
}

describe("accuracy", () => {
  // Far above the local run time, so a loaded runner doesn't time out.
  const timeout = 30_000
  // A million values for the offsets the allowances are hardest to meet
  // at, fewer for the rest.
  const scaled = (count: number) => (mutating ? count / 100 : count)

  it.each([
    [
      "a large offset with a tiny variance",
      1_000_000,
      (r: () => number) => 1e9 + r() * 1e-3,
    ],
    [
      "a huge offset with integer steps",
      1_000_000,
      (r: () => number) => 2 ** 52 + Math.floor(r() * 8),
    ],
    ["tiny values", 100_000, (r: () => number) => (r() - 0.5) * 1e-12],
    [
      "magnitudes from 1e-6 to 1e12 of either sign",
      100_000,
      (r: () => number) => (r() < 0.5 ? -1 : 1) * 10 ** (r() * 18 - 6),
    ],
    [
      "large values that cancel",
      100_000,
      (r: () => number) => (r() < 0.5 ? -1e15 : 1e15) + r(),
    ],
    ["equal values", 100_000, () => 123_456.789],
  ])(
    "stays within the catalog's allowances: %s, %i values",
    (_, count, generate) => {
      const next = random(7)
      expectAccurate(
        Float64Array.from({ length: scaled(count) }, () => generate(next))
      )
    },
    timeout
  )

  it("stays within the allowances for huge values and subnormals that cancel", () => {
    const next = random(11)
    const max = Number.MAX_VALUE
    const halves = Array.from(
      { length: 10_000 },
      () => (max / 4) * (1 + next()) * (next() < 0.5 ? -1 : 1)
    )
    const values = [...halves, ...halves.map((x) => -x)]
    for (let index = 0; index < 50; index++) {
      values.push(
        Number.MIN_VALUE * Math.ceil(next() * 1000) * (index % 2 ? -1 : 1)
      )
    }
    // Shuffled, so partial sums reach the overflow range and come back.
    for (let index = values.length - 1; index > 0; index--) {
      const other = Math.floor(next() * (index + 1))
      ;[values[index], values[other]] = [values[other] ?? 0, values[index] ?? 0]
    }
    expectAccurate(Float64Array.from(values))
  })

  // The first runs are merged long before the largest values arrive, so
  // the units grow under moments already held in pairs.
  it.each([
    ["1e30", 100],
    ["1e300", 10],
  ])(
    "stays within the allowances for magnitudes growing to %s over the rows",
    (_, perDecade) => {
      const next = random(5)
      expectAccurate(
        Float64Array.from(
          { length: 1000 },
          (_, index) => (next() - 0.5) * 10 ** (index / perDecade)
        )
      )
    }
  )

  it.each([
    [
      "magnitudes from 1e-320 to 1e300 of either sign",
      (r: () => number) => (r() < 0.5 ? -1 : 1) * 10 ** (r() * 620 - 320),
    ],
    [
      "huge values among subnormals",
      (r: () => number) =>
        (r() < 0.5 ? -1 : 1) *
        (r() < 0.1
          ? 1e300 * (1 + r())
          : Number.MIN_VALUE * Math.ceil(r() * 1e6)),
    ],
    [
      "values near the largest double",
      (r: () => number) =>
        (r() < 0.5 ? -1 : 1) * Number.MAX_VALUE * (0.5 + r() / 2),
    ],
  ])(
    "stays within the allowances for %s",
    (_, generate) => {
      for (const length of [1, 2, 3, 100, 1000]) {
        const next = random(length)
        expectAccurate(Float64Array.from({ length }, () => generate(next)))
      }
    },
    timeout
  )

  it.each([1, 2, 3, 63, 64, 65, 127, 128, 129, 1000])(
    "stays within the allowances over %i values",
    (length) => {
      const next = random(length)
      expectAccurate(Float64Array.from({ length }, () => 1e9 + next() * 1e-3))
    }
  )

  // Plain accumulation meets the allowances up to about 9 million values;
  // these values make it miss them beyond that.
  it.skipIf(mutating)(
    "keeps a sum within its allowance beyond 9 million values",
    () => {
      const count = 16_000_000
      const delta = 2 ** -53 * (1 + 2 ** -10)
      const sum = aggregate(
        fn("sum", field("score")),
        rowsOf(count + 1, (index) => (index === 0 ? 1 : delta))
      )
      const exact = 1 + count * delta
      expectWithin(sum, exact, 1e-9 * exact)
    },
    timeout
  )

  it.skipIf(mutating)(
    "keeps a mean within its allowance beyond 9 million values",
    () => {
      const count = 24_000_000
      const unit = 2 ** -52
      // Each value pulls a running mean up by just over half a unit in the
      // last place, so every update rounds the same way.
      const valueAt = (index: number) =>
        1 + index * unit + (index + 1) * 0.51 * unit
      let steps = 0
      for (let index = 0; index < count; index++) {
        steps += (valueAt(index) - 1) / unit
      }
      const exact = 1 + (steps / count) * unit
      const mean = aggregate(fn("mean", field("score")), rowsOf(count, valueAt))
      expectWithin(mean, exact, 1e-9 * valueAt(count - 1))
    },
    timeout
  )
})
