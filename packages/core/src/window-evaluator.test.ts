import { describe, expect, it } from "vitest"

import type { Expression } from "@pliantui/contract"

import type { ExpressionField } from "./check-expression"
import {
  createWindowEvaluator,
  type WindowEvaluatorOptions,
  type WindowPartitionOptions,
} from "./window-evaluator"

// Under mutation testing (PLIANT_MUTATION, set by stryker.config.mjs) the
// generated data is smaller.
const mutating = process.env["PLIANT_MUTATION"] === "1"

const fields: Record<string, ExpressionField> = {
  id: { type: "id" },
  name: { type: "string" },
  score: { type: "number" },
  qty: { type: "integer" },
  price: { type: "currency", currency: "USD" },
  active: { type: "boolean" },
  placed: { type: "date" },
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

type Options = Partial<WindowEvaluatorOptions>

function evaluatorFor(options: Options = {}) {
  return createWindowEvaluator({
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

function evaluate(
  expression: Expression,
  rows: readonly object[],
  options: Options = {},
  partition?: WindowPartitionOptions
) {
  return prepare(expression, options).compute(rows, partition)
}

function messages(expression: Expression, options: Options = {}) {
  return evaluatorFor(options)(expression).error?.issues.map(
    ({ path, message }) => ({ path, message })
  )
}

// Rows keyed a, b, c and so on, so they're in display order as given.
const scores = (...values: unknown[]) =>
  values.map((score, index) => ({ id: String.fromCharCode(97 + index), score }))

const x = field("score")

describe("createWindowEvaluator", () => {
  describe("rank and denseRank", () => {
    const rows = scores(3, 1, 3, null, 2)

    it("ranks largest first, with ties sharing a rank and leaving gaps", () => {
      expect(evaluate(fn("rank", x), rows)).toEqual([1, 4, 1, null, 3])
      expect(evaluate(fn("rank", x, value("desc")), rows)).toEqual([
        1,
        4,
        1,
        null,
        3,
      ])
    })

    it("ranks smallest first when order is asc", () => {
      expect(evaluate(fn("rank", x, value("asc")), rows)).toEqual([
        3,
        1,
        3,
        null,
        2,
      ])
    })

    it("ranks distinct values without gaps with denseRank", () => {
      expect(evaluate(fn("denseRank", x), rows)).toEqual([1, 3, 1, null, 2])
      expect(evaluate(fn("denseRank", x, value("asc")), rows)).toEqual([
        3,
        1,
        3,
        null,
        2,
      ])
    })

    it("ranks text by code point, case included", () => {
      const names = ["b", "B", "\u{1F600}", "￿"].map((name, index) => ({
        id: String(index),
        name,
      }))
      expect(evaluate(fn("rank", field("name"), value("asc")), names)).toEqual([
        2, 1, 4, 3,
      ])
    })

    it("ranks dates", () => {
      const rows = [
        { id: "a", placed: "2024-03-01" },
        { id: "b", placed: "2024-01-15" },
        { id: "c", placed: null },
        { id: "d", placed: "2024-12-31" },
      ]
      expect(evaluate(fn("rank", field("placed")), rows)).toEqual([
        2,
        3,
        null,
        1,
      ])
    })

    it("leaves out values that aren't finite numbers", () => {
      expect(evaluate(fn("rank", x), scores(Infinity, 1, Number.NaN))).toEqual([
        null,
        1,
        null,
      ])
    })
  })

  describe("runningSum", () => {
    it("sums one row at a time in display order, skipping nulls", () => {
      expect(evaluate(fn("runningSum", x), scores(1, null, 2.5, 4))).toEqual([
        1,
        null,
        3.5,
        7.5,
      ])
    })

    it("orders an unsorted partition by row key, whatever the rows' order", () => {
      const rows = [
        { id: "b", score: 2 },
        { id: "a", score: 1 },
        { id: "c", score: null },
        { id: "d", score: 4 },
      ]
      expect(evaluate(fn("runningSum", x), rows)).toEqual([3, 1, null, 7])
    })

    it("compares row keys by code point", () => {
      const rows = [
        { id: "\u{1F600}", score: 1 },
        { id: "￿", score: 10 },
        { id: "a", score: 100 },
      ]
      expect(evaluate(fn("runningSum", x), rows)).toEqual([111, 110, 100])
    })

    it("follows the table's sort, breaking ties by row key", () => {
      const rows = [
        { id: "a", score: 1 },
        { id: "c", score: 2 },
        { id: "b", score: 2 },
      ]
      const compare = (a: object, b: object) =>
        Number(Reflect.get(b, "score")) - Number(Reflect.get(a, "score"))
      expect(evaluate(fn("runningSum", x), rows, {}, { compare })).toEqual([
        5, 4, 2,
      ])
    })

    it("reads the row key with getRowId", () => {
      const rows = [
        { key: "b", score: 2 },
        { key: "a", score: 1 },
      ]
      const getRowId = (row: object) => String(Reflect.get(row, "key"))
      expect(evaluate(fn("runningSum", x), rows, { getRowId })).toEqual([3, 1])
    })

    it("keeps small values that a larger one later cancels", () => {
      expect(evaluate(fn("runningSum", x), scores(1e16, 1, -1e16))).toEqual([
        1e16,
        1e16 + 1,
        1,
      ])
    })

    it("keeps small values that cancel after a larger one arrives", () => {
      const sums = evaluate(
        fn("runningSum", x),
        scores(1e16, 1, 1e17, -1e17, -1e16)
      )
      expect(sums.at(-1)).toBe(1)
    })

    it("gives null where the sum overflows, and the sum again after", () => {
      const max = Number.MAX_VALUE
      expect(evaluate(fn("runningSum", x), scores(max, max, -max))).toEqual([
        max,
        null,
        max,
      ])
    })

    it("keeps values far below a larger one that comes later", () => {
      const max = Number.MAX_VALUE
      const running = (...values: number[]) =>
        evaluate(fn("runningSum", x), scores(...values))
      expect(running(1e-200, 3, 1e200)).toEqual([1e-200, 3, 1e200])
      expect(running(1e-300, 1e300)).toEqual([1e-300, 1e300])
      expect(running(5e-324, max)).toEqual([5e-324, max])
      const rows = [
        { id: "c", score: 1e300 },
        { id: "b", score: 5e-324 },
        { id: "a", score: 1e-300 },
      ]
      expect(evaluate(fn("runningSum", x), rows)).toEqual([
        1e300, 1e-300, 1e-300,
      ])
    })

    it("keeps an integer's type and a currency's unit", () => {
      expect(prepare(fn("runningSum", field("qty")))).toMatchObject({
        type: "integer",
      })
      expect(prepare(fn("runningSum", field("price")))).toMatchObject({
        type: "number",
        unit: "USD",
      })
    })
  })

  describe("share", () => {
    it("divides x by the partition's sum, skipping nulls", () => {
      expect(evaluate(fn("share", x), scores(1, 3, null, 4))).toEqual([
        0.125,
        0.375,
        null,
        0.5,
      ])
    })

    it("gives null when the sum is 0", () => {
      expect(evaluate(fn("share", x), scores(1, -1, null))).toEqual([
        null,
        null,
        null,
      ])
    })

    it("divides by a sum that overflows", () => {
      const max = Number.MAX_VALUE
      expect(evaluate(fn("share", x), scores(max, max, -max))).toEqual([
        1, 1, -1,
      ])
    })

    it("is a percent", () => {
      expect(prepare(fn("share", field("price")))).toEqual(
        expect.objectContaining({ type: "number", unit: "percent" })
      )
    })
  })

  describe("zScore", () => {
    it("divides the distance from the mean by the sample deviation", () => {
      expect(evaluate(fn("zScore", x), scores(3, null, 1, 2))).toEqual([
        1,
        null,
        -1,
        0,
      ])
    })

    it("gives null with fewer than 2 values or no deviation", () => {
      expect(evaluate(fn("zScore", x), scores(5, null))).toEqual([null, null])
      expect(evaluate(fn("zScore", x), scores(3, 3, 3))).toEqual([
        null,
        null,
        null,
      ])
    })

    it("scores values whose squares overflow or underflow", () => {
      const max = Number.MAX_VALUE
      const huge = evaluate(fn("zScore", x), scores(max, 0, -max))
      expect(huge).toEqual([1, 0, -1])
      expect(
        evaluate(fn("zScore", x), scores(5e-324, 1e-323, 1.5e-323))
      ).toEqual([-1, 0, 1])
    })

    it("has no unit", () => {
      const { type, unit } = prepare(fn("zScore", field("price")))
      expect({ type, unit }).toEqual({ type: "number", unit: undefined })
    })
  })

  describe("partitions", () => {
    it("gives nothing for no rows", () => {
      for (const name of [
        "rank",
        "denseRank",
        "runningSum",
        "share",
        "zScore",
      ]) {
        expect(evaluate(fn(name, x), [])).toEqual([])
      }
    })

    it("computes over a single row", () => {
      const row = scores(4)
      expect(evaluate(fn("rank", x), row)).toEqual([1])
      expect(evaluate(fn("denseRank", x), row)).toEqual([1])
      expect(evaluate(fn("runningSum", x), row)).toEqual([4])
      expect(evaluate(fn("share", x), row)).toEqual([1])
      expect(evaluate(fn("zScore", x), row)).toEqual([null])
    })

    it("computes each partition on its own", () => {
      const expression = prepare(fn("share", x))
      expect(expression.compute(scores(1, 3))).toEqual([0.25, 0.75])
      expect(expression.compute(scores(2, 2))).toEqual([0.5, 0.5])
    })
  })

  describe("expressions", () => {
    it("combines window functions with row functions", () => {
      const rows = scores(30, 10, 20)
      expect(evaluate(fn("lte", fn("rank", x), value(2)), rows)).toEqual([
        true,
        false,
        true,
      ])
      expect(
        evaluate(fn("sub", fn("runningSum", x), fn("share", x)), rows)
      ).toEqual([30 - 0.5, 40 - 1 / 6, 60 - 1 / 3])
    })

    it("evaluates the row expressions window functions read", () => {
      const rows = [
        { id: "a", price: 2, qty: 3 },
        { id: "b", price: 5, qty: null },
        { id: "c", price: 1, qty: 4 },
      ]
      const derived = { total: fn("mul", field("price"), field("qty")) }
      expect(
        evaluate(fn("runningSum", ref("total")), rows, { derived })
      ).toEqual([6, null, 10])
      expect(
        evaluate(fn("runningSum", fn("mul", field("price"), value(2))), rows)
      ).toEqual([4, 14, 16])
    })

    it("computes derived fields that use window functions", () => {
      const rows = [
        { id: "a", score: 3, active: true },
        { id: "b", score: 2, active: false },
        { id: "c", score: 1, active: true },
      ]
      const derived = {
        top: fn("lte", fn("rank", x), value(2)),
        flagged: fn("and", ref("top"), field("active")),
      }
      expect(evaluate(ref("flagged"), rows, { derived })).toEqual([
        true,
        false,
        false,
      ])
    })

    it("computes an expression without window functions row by row", () => {
      expect(evaluate(fn("add", x, value(1)), scores(1, null, 2))).toEqual([
        2,
        null,
        3,
      ])
    })

    it("gives dates as text", () => {
      const rows = [{ id: "a", placed: "2024-03-01", score: 1 }]
      expect(
        evaluate(
          fn(
            "if",
            fn("eq", fn("rank", x), value(1)),
            field("placed"),
            value(null)
          ),
          rows
        )
      ).toEqual(["2024-03-01"])
    })
  })

  describe("today", () => {
    it("reads the current date when the partition is computed", () => {
      const now = Date.parse("2024-06-30T20:00:00Z")
      const expression = fn(
        "if",
        fn("eq", fn("rank", x), value(1)),
        fn("today"),
        value(null)
      )
      expect(evaluate(expression, scores(2, 1), { now: () => now })).toEqual([
        "2024-07-01",
        null,
      ])
    })
  })

  describe("issues", () => {
    it("reports what the checker reports", () => {
      expect(messages(fn("runningSum", fn("rank", x)))).toEqual([
        {
          path: ["args", 0, "fn"],
          message:
            "rank is a window function, which can't be nested in runningSum",
        },
      ])
      expect(messages(fn("sum", x))).toEqual([
        {
          path: ["fn"],
          message:
            "sum is an aggregate function, which a row expression can't use",
        },
      ])
    })

    it("throws for an unknown time zone", () => {
      expect(() => evaluatorFor({ timeZone: "Nowhere/Else" })).toThrow(
        RangeError
      )
    })

    it("fails an expression given an unknown time zone", () => {
      expect(
        evaluatorFor()(fn("rank", x), { todayTimeZone: "Nowhere/Else" }).error
          ?.issues[0]?.message
      ).toBe('Unknown time zone "Nowhere/Else"')
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

// big × 2^exponent as the nearest double, give or take a unit in the 60th
// bit, without overflowing on the way.
function toNumber(big: bigint, exponent: number) {
  const length = (big < 0n ? -big : big).toString(2).length
  const shift = Math.max(0, length - 64)
  const scale = exponent + shift
  const half = Math.trunc(scale / 2)
  return Number(big >> BigInt(shift)) * 2 ** half * 2 ** (scale - half)
}

function expectWithin(actual: unknown, exact: number, allowance: number) {
  expect(typeof actual).toBe("number")
  expect(Math.abs(Number(actual) - exact)).toBeLessThanOrEqual(allowance)
}

/**
 * Checks runningSum, share and zScore over the values, in order, against
 * exact results computed with integers and the catalog's allowances.
 */
function expectAccurate(values: Float64Array) {
  const n = values.length
  const rows = Array.from(values, (score, index) => ({
    id: String(index).padStart(8, "0"),
    score,
  }))
  const running = evaluate(fn("runningSum", x), rows)
  const shares = evaluate(fn("share", x), rows)
  const scores = evaluate(fn("zScore", x), rows)

  const parts = Array.from(values, partsOf)
  let low = Infinity
  for (const [mantissa, exponent] of parts) {
    if (mantissa !== 0n) {
      low = Math.min(low, exponent)
    }
  }
  // Each value as an integer count of 2^low.
  const units = parts.map(([mantissa, exponent]) =>
    mantissa === 0n ? 0n : mantissa << BigInt(exponent - low)
  )

  let prefix = 0n
  let absolute = 0
  units.forEach((unit, index) => {
    prefix += unit
    absolute += Math.abs(values[index] ?? 0)
    expectWithin(running[index], toNumber(prefix, low), 1e-9 * absolute)
  })

  // Shares and scores don't change with the scale, nor do their
  // allowances, so they're checked in units of 2^low.
  let total = 0n
  let squares = 0n
  for (const unit of units) {
    total += unit
    squares += unit * unit
  }
  const xs = units.map((unit) => toNumber(unit, 0))
  const T = toNumber(total, 0)
  const A = xs.reduce((sum, x) => sum + Math.abs(x), 0)
  xs.forEach((x, index) => {
    if (1e-9 * A <= Math.abs(T) / 2) {
      const allowance = (1e-9 * A * Math.max(Math.abs(x), Math.abs(T))) / T ** 2
      expectWithin(shares[index], x / T, allowance)
    }
  })

  const big = BigInt(n)
  const q = big * squares - total * total
  const k = Math.ceil(q.toString(2).length / 2)
  const denominator = Math.sqrt((toNumber(q, -2 * k) * n) / (n - 1))
  const sigma = Math.sqrt(toNumber(q, 0) / (n * (n - 1)))
  const mean = T / n
  const M = xs.reduce((most, x) => Math.max(most, Math.abs(x)), 0)
  const D = xs.reduce((most, x) => Math.max(most, Math.abs(x - mean)), 0)
  const V = 1e-9 * M * (D + 1e-9 * M)
  const S = sigma === 0 ? Math.sqrt(V) : Math.min(Math.sqrt(V), V / sigma)
  if (S < sigma / 2) {
    units.forEach((unit, index) => {
      const z = toNumber(big * unit - total, -k) / denominator
      expectWithin(scores[index], z, (1e-9 * M + Math.abs(z) * S) / (sigma - S))
    })
  }
}

describe("accuracy", () => {
  // Far above the local run time, so a loaded runner doesn't time out.
  const timeout = 30_000
  const scaled = (count: number) => (mutating ? count / 100 : count)

  it.each([
    [
      "a large offset with a tiny variance",
      100_000,
      (r: () => number) => 1e9 + r() * 1e-3,
    ],
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
    ["huge values", 1000, (r: () => number) => (r() - 0.5) * 1e305],
    ["subnormal values", 1000, (r: () => number) => r() * 1e-310],
  ])(
    "stays within the catalog's allowances: %s, %i values",
    (_, count, generate) => {
      const next = random(11)
      expectAccurate(
        Float64Array.from({ length: scaled(count) }, () => generate(next))
      )
    },
    timeout
  )
})
