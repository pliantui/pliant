import { describe, expect, it } from "vitest"

import { functionSignatures, type Expression } from "@pliantui/contract"

import type { ExpressionField } from "./check-expression"
import { createRowEvaluator, type RowValue } from "./row-evaluator"

const fields: Record<string, ExpressionField> = {
  a: { type: "number" },
  b: { type: "number" },
  c: { type: "number" },
  i: { type: "integer" },
  s: { type: "string" },
  t: { type: "string" },
  p: { type: "boolean" },
  q: { type: "boolean" },
  r: { type: "boolean" },
  d: { type: "date" },
  e: { type: "date" },
  dt: { type: "datetime" },
}

type Literal = string | number | boolean | null

const field = (id: string): Expression => ({ field: id })
const value = (literal: Literal): Expression => ({ value: literal })
const fn = (name: string, ...args: Expression[]): Expression => ({
  fn: name,
  args,
})

const now = Date.parse("2024-06-15T12:00:00Z")

function call(
  name: string,
  args: readonly (Expression | Literal)[],
  row: object = {},
  timeZone = "UTC"
): RowValue {
  const result = createRowEvaluator({ fields, timeZone, now: () => now })(
    fn(
      name,
      ...args.map((arg) =>
        arg !== null && typeof arg === "object" ? arg : value(arg)
      )
    )
  )
  if (!result.success) {
    throw result.error
  }
  return result.data.accessor(row)
}

// A small seeded generator, so property checks are reproducible.
function random(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31
    return state / 2 ** 31
  }
}

describe("row functions", () => {
  it("implements every row function in the catalog", () => {
    const rowNames = Object.entries(functionSignatures)
      .filter(([, { kind }]) => kind === "row")
      .map(([name]) => name)
    const evaluator = createRowEvaluator({ fields, timeZone: "UTC" })
    const samples: Record<string, Expression[]> = {
      today: [],
      age: [field("d")],
      round: [field("a")],
      dateDiff: [field("d"), field("e"), value("days")],
      datePart: [field("d"), value("year")],
      dateTrunc: [field("d"), value("week")],
      addDays: [field("d"), field("i")],
      left: [field("s"), field("i")],
      right: [field("s"), field("i")],
    }
    for (const name of rowNames) {
      const { args } =
        functionSignatures[name as keyof typeof functionSignatures]
      const ids: Record<string, string> = {}
      const sample =
        samples[name] ??
        args.map(({ name: argName, type }) => {
          const id =
            typeof type === "object" && "like" in type
              ? (ids[type.like] ?? "a")
              : type === "boolean"
                ? "p"
                : type === "string"
                  ? "s"
                  : "a"
          ids[argName] = id
          return field(id)
        })
      expect(evaluator(fn(name, ...sample)).success, name).toBe(true)
    }
  })

  describe("arithmetic", () => {
    it.each([
      ["add", [2, 3], 5],
      ["add", [0.1, 0.2], 0.1 + 0.2],
      ["sub", [2, 3], -1],
      ["mul", [2.5, 4], 10],
      ["mul", [-2, 0], 0],
      ["div", [7, 2], 3.5],
      ["div", [-1, 4], -0.25],
      ["div", [0, 5], 0],
      ["div", [5, 0], null],
      ["div", [0, 0], null],
      ["abs", [-3.5], 3.5],
      ["floor", [-2.5], -3],
      ["floor", [2.5], 2],
      ["ceil", [-2.5], -2],
      ["ceil", [2.1], 3],
      ["min2", [2, -3], -3],
      ["max2", [2, -3], 2],
      ["clamp", [5, 0, 3], 3],
      ["clamp", [-5, 0, 3], 0],
      ["clamp", [2, 0, 3], 2],
      ["clamp", [2, 3, 0], null],
      ["percentChange", [50, 75], 0.5],
      ["percentChange", [-50, -25], 0.5],
      ["percentChange", [-50, -75], -0.5],
      ["percentChange", [0, 10], null],
    ] as const)("%s(%j) is %j", (name, args, expected) => {
      expect(call(name, args)).toBe(expected)
    })

    it("gives 0, not -0", () => {
      expect(Object.is(call("mul", [-2, 0]), 0)).toBe(true)
      expect(Object.is(call("ceil", [-0.5]), 0)).toBe(true)
      expect(Object.is(call("round", [-0.4]), 0)).toBe(true)
    })

    it.each([
      [[1.005, 2], 1.01],
      [[2.5], 3],
      [[-2.5], -3],
      [[0.5], 1],
      [[1.45, 1], 1.5],
      [[8.345, 2], 8.35],
      [[-8.345, 2], -8.35],
      [[123.456, 0], 123],
      [[1e-7, 2], 0],
      [[0.000_005, 5], 0.000_01],
      [[1.234_567_890_123_456_8e-10, 10], 1e-10],
      [[1e21, 2], 1e21],
      [[12, 3], 12],
      [[0, 4], 0],
    ] as const)("round(%j) is %j", (args, expected) => {
      expect(call("round", args)).toBe(expected)
    })

    it("rounds to at most the given decimals, within half a unit (property)", () => {
      const next = random(1)
      for (let run = 0; run < 2000; run++) {
        const x = (next() - 0.5) * 10 ** Math.floor(next() * 12 - 4)
        const digits = Math.floor(next() * 11)
        const rounded = call("round", [x, digits])
        expect(typeof rounded).toBe("number")
        const scaled = Number(rounded) * 10 ** digits
        expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(
          1e-6 * Math.max(1, Math.abs(scaled))
        )
        // Half a unit, plus the spacing of doubles near x.
        expect(Math.abs(Number(rounded) - x)).toBeLessThanOrEqual(
          0.5 * 10 ** -digits + 4 * Number.EPSILON * Math.abs(x)
        )
        expect(call("round", [rounded, digits])).toBe(rounded)
      }
    })

    it("computes arithmetic as IEEE 754 doubles do (property)", () => {
      const next = random(2)
      const number = () => (next() - 0.5) * 10 ** Math.floor(next() * 20 - 6)
      for (let run = 0; run < 500; run++) {
        const row = { a: number(), b: number() }
        const { a, b } = row
        const read = (name: string) => call(name, [field("a"), field("b")], row)
        expect(read("add")).toBe(a + b)
        expect(read("sub")).toBe(a - b)
        expect(read("mul")).toBe(a * b)
        expect(read("div")).toBe(a / b)
        expect(read("min2")).toBe(Math.min(a, b))
        expect(read("max2")).toBe(Math.max(a, b))
        expect(read("gt")).toBe(a > b)
        expect(read("eq")).toBe(a === b)
      }
    })

    it("measures percentChange from the absolute base, so a rise is positive (property)", () => {
      const next = random(5)
      for (let run = 0; run < 500; run++) {
        const row = { a: (next() - 0.5) * 1000, b: (next() - 0.5) * 1000 }
        const change = Number(
          call("percentChange", [field("a"), field("b")], row)
        )
        expect(change).toBe((row.b - row.a) / Math.abs(row.a))
        expect(Math.sign(change)).toBe(Math.sign(row.b - row.a))
      }
    })
  })

  describe("logic", () => {
    const cases: [Literal, Literal, boolean | null, boolean | null][] = [
      [true, true, true, true],
      [true, false, false, true],
      [true, null, null, true],
      [false, false, false, false],
      [false, null, false, null],
      [null, null, null, null],
    ]

    it.each(cases)("and/or(%j, %j) by three-valued logic", (p, q, and, or) => {
      const row = { p, q }
      expect(call("and", [field("p"), field("q")], row)).toBe(and)
      expect(call("and", [field("q"), field("p")], row)).toBe(and)
      expect(call("or", [field("p"), field("q")], row)).toBe(or)
      expect(call("or", [field("q"), field("p")], row)).toBe(or)
    })

    it("takes many arguments", () => {
      expect(call("and", [true, true, true, false])).toBe(false)
      expect(call("and", [true, field("p"), true])).toBeNull()
      expect(call("or", [false, false, field("p"), true])).toBe(true)
      expect(call("or", [false, false, field("p")])).toBeNull()
    })

    it.each([
      [true, false],
      [false, true],
      [null, null],
    ])("not(%j) is %j", (p, expected) => {
      expect(call("not", [field("p")], { p })).toBe(expected)
    })

    it("picks then or else, and else for a null condition", () => {
      const pick = (p: Literal) =>
        call("if", [field("p"), field("s"), field("t")], {
          p,
          s: "yes",
          t: "no",
        })
      expect(pick(true)).toBe("yes")
      expect(pick(false)).toBe("no")
      expect(pick(null)).toBe("no")
      expect(call("if", [true, null, 1])).toBeNull()
      expect(call("if", [false, null, 1])).toBe(1)
    })

    it("tests for null", () => {
      expect(call("isNull", [field("a")])).toBe(true)
      expect(call("isNull", [field("a")], { a: 0 })).toBe(false)
      expect(call("isNull", [field("s")], { s: "" })).toBe(false)
    })

    it("coalesces to the first value that isn't null", () => {
      expect(call("coalesce", [field("a"), field("b"), 3], { b: 0 })).toBe(0)
      expect(call("coalesce", [field("a"), field("b")])).toBeNull()
      expect(call("coalesce", [field("s"), "x"], { s: "" })).toBe("")
    })
  })

  describe("comparison", () => {
    it.each([
      ["eq", [1, 1], true],
      ["eq", [1, 1.5], false],
      ["eq", [true, true], true],
      ["eq", ["a", "A"], false],
      ["eq", ["", ""], true],
      ["neq", [true, false], true],
      ["neq", ["a", "a"], false],
      ["gt", [2, 1], true],
      ["gt", [1, 1], false],
      ["gte", [1, 1], true],
      ["lt", ["B", "a"], true],
      ["lt", ["a", "B"], false],
      ["lt", ["", "a"], true],
      ["lte", ["a", "a"], true],
      ["between", [2, 1, 3], true],
      ["between", [1, 1, 3], true],
      ["between", [3, 1, 3], true],
      ["between", [4, 1, 3], false],
      ["between", [2, 3, 1], false],
      ["in", [2, 1, 2, 3], true],
      ["in", [4, 1, 2, 3], false],
      ["in", ["a", "A"], false],
      ["min2", ["b", "a"], "a"],
      ["max2", ["Z", "a"], "a"],
    ] as const)("%s(%j) is %j", (name, args, expected) => {
      expect(call(name, args)).toBe(expected)
    })

    it("gives null when an argument is null", () => {
      for (const name of [
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "min2",
        "max2",
      ]) {
        expect(call(name, [field("a"), 1]), name).toBeNull()
        expect(call(name, [1, field("a")]), name).toBeNull()
      }
      expect(call("between", [1, field("a"), 2])).toBeNull()
      expect(call("clamp", [1, 0, field("a")])).toBeNull()
    })

    it("gives null from in when x is null, and never matches a null value", () => {
      expect(call("in", [field("a"), 1, 2])).toBeNull()
      expect(call("in", [1, field("a"), 2])).toBe(false)
      expect(call("in", [2, field("a"), 2])).toBe(true)
    })

    it("compares strings by code point", () => {
      // U+FF21 is a single UTF-16 unit, U+1F600 a surrogate pair starting
      // with 0xD83D, so code units and code points order them differently.
      expect(call("lt", ["Ａ", "\u{1F600}"])).toBe(true)
      expect(call("gt", ["\u{1F600}", "Ａ"])).toBe(true)
      expect(call("max2", ["Ａ", "\u{1F600}"])).toBe("\u{1F600}")
      expect(call("lt", ["\u{1F600}", "\u{1F601}"])).toBe(true)
    })

    it("orders strings as their code points do (property)", () => {
      const next = random(3)
      const alphabet = [
        "a",
        "B",
        "é",
        "\uD7FF",
        "\uE000",
        "\uFFFF",
        "\u{10000}",
        "\u{1F600}",
        "\uD800",
        "\uDC00",
        "",
      ]
      const word = () =>
        Array.from(
          { length: Math.floor(next() * 4) },
          () => alphabet[Math.floor(next() * alphabet.length)]
        ).join("")
      const points = (text: string) =>
        Array.from(text, (char) => char.codePointAt(0) ?? 0)
      for (let run = 0; run < 2000; run++) {
        const a = word()
        const b = word()
        const [left, right] = [points(a), points(b)]
        let expected = left.length - right.length
        for (
          let index = 0;
          index < Math.min(left.length, right.length);
          index++
        ) {
          const difference = (left[index] ?? 0) - (right[index] ?? 0)
          if (difference !== 0) {
            expected = difference
            break
          }
        }
        expect(call("lt", [a, b]), `${a} < ${b}`).toBe(expected < 0)
        expect(call("eq", [a, b])).toBe(expected === 0)
      }
    })
  })

  describe("text", () => {
    it.each([
      ["concat", ["a", "b", "c"], "abc"],
      ["lower", ["ÀBÇ İ"], "àbç i̇"],
      ["upper", ["straße"], "STRASSE"],
      ["length", [""], 0],
      ["length", ["a\u{1F600}b"], 3],
      ["contains", ["Hello", "ell"], true],
      ["contains", ["Hello", "ELL"], false],
      ["contains", ["Hello", ""], true],
      ["startsWith", ["Hello", "He"], true],
      ["startsWith", ["Hello", "he"], false],
      ["eqI", ["Hello", "hELLO"], true],
      ["eqI", ["Hello", "Hell"], false],
      ["eqI", ["", ""], true],
      ["eqI", ["ÉCOLE", "école"], true],
      ["eqI", ["STRASSE", "straße"], false],
      ["eqI", ["ẞ", "ß"], true],
      ["eqI", ["İ", "i"], false],
      ["eqI", ["I", "ı"], false],
      ["containsI", ["Hello", "ELL"], true],
      ["containsI", ["Hello", "elo"], false],
      ["containsI", ["Hello", ""], true],
      ["containsI", ["", ""], true],
      ["containsI", ["", "a"], false],
      ["containsI", ["Café", "É"], true],
      ["containsI", ["İstanbul", "i"], true],
      ["containsI", ["Straße", "SS"], false],
      ["containsI", ["ΟΔΟΣ", "Σ"], false],
      ["eqI", ["ΟΔΟΣ", "οδοσ"], false],
      ["startsWithI", ["Hello", "hE"], true],
      ["startsWithI", ["Hello", "el"], false],
      ["startsWithI", ["Hello", ""], true],
      ["startsWithI", ["Élan", "é"], true],
      ["startsWithI", ["İzmir", "İ"], true],
      ["startsWithI", ["İzmir", "iz"], false],
      ["left", ["a\u{1F600}bc", 2], "a\u{1F600}"],
      ["left", ["abc", 0], ""],
      ["left", ["abc", -1], ""],
      ["left", ["abc", 10], "abc"],
      ["right", ["ab\u{1F600}", 1], "\u{1F600}"],
      ["right", ["abc", 0], ""],
      ["right", ["abc", -2], ""],
      ["right", ["abc", 10], "abc"],
    ] as const)("%s(%j) is %j", (name, args, expected) => {
      expect(call(name, args)).toBe(expected)
    })

    it("doesn't match half of a surrogate pair", () => {
      const smile = "\u{1F600}"
      const high = smile.charAt(0)
      const low = smile.charAt(1)
      expect(call("contains", [`a${smile}b`, high])).toBe(false)
      expect(call("contains", [`a${smile}b`, low])).toBe(false)
      expect(call("contains", [`a${smile}b`, `${low}b`])).toBe(false)
      expect(call("contains", [`a${smile}b`, `a${high}`])).toBe(false)
      expect(call("contains", [`a${smile}b`, smile])).toBe(true)
      expect(call("contains", [`${smile}${high}`, high])).toBe(true)
      expect(call("startsWith", [smile, high])).toBe(false)
      expect(call("startsWith", [`${smile}b`, smile])).toBe(true)
      expect(call("startsWith", [`${high}b`, high])).toBe(true)
      expect(call("containsI", [`A${smile}B`, high])).toBe(false)
      expect(call("containsI", [`A${smile}B`, `${low}b`])).toBe(false)
      expect(call("containsI", [`A${smile}B`, `a${smile}b`])).toBe(true)
      expect(call("startsWithI", [smile, high])).toBe(false)
      expect(call("startsWithI", [`${smile}B`, `${smile}b`])).toBe(true)
      expect(call("eqI", [`${smile}A`, `${smile}a`])).toBe(true)
    })

    it("matches code points after toLowerCase (property)", () => {
      const next = random(5)
      const alphabet = [
        "a",
        "A",
        "é",
        "É",
        "ß",
        "ẞ",
        "İ",
        "i",
        "ı",
        "I",
        "Σ",
        "σ",
        "ς",
        "\u{1F600}",
        "\uD800",
        "\uDC00",
        "\u{10400}",
        "\u{10428}",
        "\uD801",
        "\uDC28",
      ]
      const word = (longest: number) =>
        Array.from(
          { length: Math.floor(next() * (longest + 1)) },
          () => alphabet[Math.floor(next() * alphabet.length)]
        ).join("")
      // Compares lists of code points, so a match can't split a surrogate
      // pair.
      const points = (text: string) => Array.from(text.toLowerCase())
      const startsAt = (text: string[], search: string[], start: number) =>
        search.every((point, index) => text[start + index] === point)
      const expected = {
        eqI: (a: string[], b: string[]) => a.join("") === b.join(""),
        containsI: (a: string[], b: string[]) =>
          Array.from({ length: a.length - b.length + 1 }, (_, start) =>
            startsAt(a, b, start)
          ).includes(true),
        startsWithI: (a: string[], b: string[]) => startsAt(a, b, 0),
      }
      const evaluate = createRowEvaluator({ fields, timeZone: "UTC" })
      const checks = Object.entries(expected).map(([name, oracle]) => {
        const result = evaluate(fn(name, field("s"), field("t")))
        if (!result.success) {
          throw result.error
        }
        return { name, oracle, accessor: result.data.accessor }
      })
      for (let run = 0; run < 5000; run++) {
        const a = word(4)
        const b = word(2)
        for (const { name, oracle, accessor } of checks) {
          expect(accessor({ s: a, t: b }), `${name}(${a}, ${b})`).toBe(
            oracle(points(a), points(b))
          )
        }
      }
    })

    it("joins null arguments as empty strings and is never null", () => {
      expect(call("concat", [field("s"), "-", field("t")], { t: "x" })).toBe(
        "-x"
      )
      expect(call("concat", [field("s"), field("t")])).toBe("")
    })

    it("gives null from the other text functions when an argument is null", () => {
      for (const name of ["lower", "upper", "length"]) {
        expect(call(name, [field("s")]), name).toBeNull()
      }
      for (const name of [
        "eqI",
        "contains",
        "containsI",
        "startsWith",
        "startsWithI",
      ]) {
        expect(call(name, [field("s"), "a"]), name).toBeNull()
        expect(call(name, ["a", field("s")]), name).toBeNull()
      }
      expect(call("left", ["abc", field("i")])).toBeNull()
      expect(call("right", [field("s"), 1])).toBeNull()
    })
  })

  describe("dates", () => {
    it.each([
      [["2024-01-01", "2024-03-01", "days"], 60],
      [["2024-03-01", "2024-01-01", "days"], -60],
      [["2024-01-01", "2024-01-14", "weeks"], 1],
      [["2024-01-14", "2024-01-01", "weeks"], -1],
      [["2024-01-31", "2024-02-29", "months"], 1],
      [["2023-01-31", "2023-02-28", "months"], 1],
      [["2024-01-31", "2024-02-28", "months"], 0],
      [["2024-02-29", "2024-01-31", "months"], -1],
      [["2024-01-15", "2024-02-14", "months"], 0],
      [["2024-01-15", "2024-02-15", "months"], 1],
      [["2024-02-29", "2025-02-28", "years"], 1],
      [["2024-02-29", "2025-02-27", "years"], 0],
      [["2025-02-28", "2024-02-29", "years"], -1],
      [["2000-06-15", "2024-06-14", "years"], 23],
    ] as const)("dateDiff(%j) is %j", (args, expected) => {
      expect(call("dateDiff", args)).toBe(expected)
    })

    it("counts dateDiff between the dates of datetimes in the dataset's time zone", () => {
      const row = { dt: "2024-01-01T20:00:00Z", d: "2024-01-02" }
      expect(
        call("dateDiff", [field("dt"), field("d"), "days"], row, "UTC")
      ).toBe(1)
      expect(
        call("dateDiff", [field("dt"), field("d"), "days"], row, "Asia/Kolkata")
      ).toBe(0)
    })

    it("negates dateDiff when its dates are swapped (property)", () => {
      const next = random(4)
      const day = () =>
        new Date(
          Date.UTC(1990, 0, 1) + Math.floor(next() * 20_000) * 86_400_000
        )
          .toISOString()
          .slice(0, 10)
      for (let run = 0; run < 500; run++) {
        const [a, b] = [day(), day()]
        for (const unit of ["days", "weeks", "months", "years"]) {
          expect(call("dateDiff", [b, a, unit])).toBe(
            -Number(call("dateDiff", [a, b, unit])) + 0
          )
        }
        const months = Number(call("dateDiff", [a, b, "months"]))
        expect(call("dateDiff", [a, b, "years"])).toBe(
          Math.trunc(months / 12) + 0
        )
        const days = Number(call("dateDiff", [a, b, "days"]))
        expect(call("addDays", [a, days])).toBe(b)
        expect(call("dateDiff", [a, b, "weeks"])).toBe(Math.trunc(days / 7) + 0)
      }
    })

    it.each([
      ["2024-02-29", "year", 2024],
      ["2024-02-29", "quarter", 1],
      ["2024-07-01", "quarter", 3],
      ["2024-12-31", "quarter", 4],
      ["2024-02-29", "month", 2],
      ["2024-02-29", "day", 29],
      ["2024-12-30", "weekday", 1],
      ["2024-12-29", "weekday", 7],
      ["2024-12-31", "week", 1],
      ["2021-01-03", "week", 53],
      ["2026-12-31", "week", 53],
      ["2024-01-01", "week", 1],
      ["2023-01-01", "week", 52],
    ] as const)("datePart(%s, %s) is %j", (date, part, expected) => {
      expect(call("datePart", [date, part])).toBe(expected)
    })

    it.each([
      ["2024-02-29", "day", "2024-02-29"],
      ["2024-02-29", "week", "2024-02-26"],
      ["2024-03-03", "week", "2024-02-26"],
      ["2024-03-04", "week", "2024-03-04"],
      ["2024-02-29", "month", "2024-02-01"],
      ["2024-05-15", "quarter", "2024-04-01"],
      ["2024-12-31", "quarter", "2024-10-01"],
      ["2024-12-31", "year", "2024-01-01"],
    ] as const)("dateTrunc(%s, %s) is %s", (date, unit, expected) => {
      expect(call("dateTrunc", [date, unit])).toBe(expected)
    })

    it("reads datePart and dateTrunc of a datetime in the dataset's time zone", () => {
      const row = { dt: "2024-12-31T20:00:00Z" }
      expect(call("datePart", [field("dt"), "year"], row, "Asia/Tokyo")).toBe(
        2025
      )
      expect(call("dateTrunc", [field("dt"), "month"], row, "Asia/Tokyo")).toBe(
        "2025-01-01"
      )
      expect(call("dateTrunc", [field("dt"), "month"], row, "UTC")).toBe(
        "2024-12-01"
      )
    })

    describe("with a date and a datetime", () => {
      // In Kolkata, 2024-03-01 starts at 2024-02-29T18:30:00Z.
      const zone = "Asia/Kolkata"
      const at = (dt: string) => ({ d: "2024-03-01", dt })

      it("reads the date as the start of its day where they meet", () => {
        const midnight = at("2024-02-29T18:30:00Z")
        const later = at("2024-02-29T18:30:00.001Z")
        expect(call("in", [field("dt"), field("d")], midnight, zone)).toBe(true)
        expect(call("in", [field("dt"), field("d")], later, zone)).toBe(false)
        expect(
          call("in", [field("d"), field("dt"), "2024-01-01"], midnight, zone)
        ).toBe(true)
        expect(
          call("between", [field("dt"), field("d"), "2024-03-02"], later, zone)
        ).toBe(true)
        expect(
          call("between", [field("dt"), "2024-02-01", field("d")], later, zone)
        ).toBe(false)
        expect(call("min2", [field("d"), field("dt")], later, zone)).toBe(
          "2024-02-29T18:30:00.000Z"
        )
        expect(call("max2", [field("d"), field("dt")], later, zone)).toBe(
          "2024-02-29T18:30:00.001Z"
        )
        expect(call("if", [true, field("d"), field("dt")], later, zone)).toBe(
          "2024-02-29T18:30:00.000Z"
        )
        expect(call("if", [false, field("d"), field("dt")], later, zone)).toBe(
          "2024-02-29T18:30:00.001Z"
        )
      })
    })

    it("adds days to a date", () => {
      expect(call("addDays", ["2024-02-28", 1])).toBe("2024-02-29")
      expect(call("addDays", ["2024-03-01", -1])).toBe("2024-02-29")
      expect(call("addDays", ["2024-03-01", 0])).toBe("2024-03-01")
    })

    it("adds days to a datetime keeping its wall-clock time in the dataset's time zone", () => {
      const zone = "America/New_York"
      // Clocks go forward on 2024-03-10, so the day has 23 hours.
      expect(call("addDays", ["2024-03-09T12:00:00-05:00", 1], {}, zone)).toBe(
        "2024-03-10T16:00:00.000Z"
      )
      expect(call("addDays", ["2024-11-03T12:00:00-05:00", -1], {}, zone)).toBe(
        "2024-11-02T16:00:00.000Z"
      )
    })

    it("moves a wall-clock time a transition skips forward, and takes the earlier of a repeated one", () => {
      const zone = "America/New_York"
      const nextDay = (dt: string) =>
        call("addDays", [field("dt"), 1], { dt }, zone)
      expect(nextDay("2024-03-09T02:30:00")).toBe("2024-03-10T07:30:00.000Z")
      expect(nextDay("2024-11-02T01:30:00")).toBe("2024-11-03T05:30:00.000Z")
      expect(
        call(
          "eq",
          [field("dt"), "2024-03-10T07:30:00Z"],
          { dt: "2024-03-10T02:30:00" },
          zone
        )
      ).toBe(true)
      expect(
        call(
          "eq",
          [field("dt"), "2024-11-03T05:30:00Z"],
          { dt: "2024-11-03T01:30:00" },
          zone
        )
      ).toBe(true)
    })

    it("keeps dates to the years 0000 to 9999", () => {
      expect(call("addDays", ["9999-12-30", 1])).toBe("9999-12-31")
      expect(call("addDays", ["9999-12-31", 1])).toBeNull()
      expect(call("addDays", ["0000-01-02", -1])).toBe("0000-01-01")
      expect(call("addDays", ["0000-01-01", -1])).toBeNull()
      expect(call("addDays", ["2024-01-01", 1e15])).toBeNull()
      expect(call("addDays", ["2024-01-01", -1e300])).toBeNull()
      expect(call("addDays", ["9999-12-31T23:59:59.999Z", 0])).toBe(
        "9999-12-31T23:59:59.999Z"
      )
      expect(call("addDays", ["9999-12-31T00:00:00Z", 1])).toBeNull()
      expect(call("addDays", ["0000-01-01T00:00:00Z", -1])).toBeNull()
      expect(call("addDays", ["2024-01-01T00:00:00Z", 1e15])).toBeNull()
    })

    it("gives null for a truncated date before the year 0000", () => {
      // 0000-01-01 is a Saturday, so its week starts in the year before.
      expect(call("dateTrunc", ["0000-01-01", "week"])).toBeNull()
      expect(call("dateTrunc", ["0000-01-02", "week"])).toBeNull()
      expect(call("dateTrunc", ["0000-01-03", "week"])).toBe("0000-01-03")
      expect(call("dateTrunc", ["0000-01-04", "week"])).toBe("0000-01-03")
      expect(call("dateTrunc", ["9999-12-31", "week"])).toBe("9999-12-27")
      expect(call("dateTrunc", ["0000-01-01", "year"])).toBe("0000-01-01")
      expect(
        call("dateTrunc", [
          fn("addDays", value("1970-01-01"), value(-99_999_998)),
          "week",
        ])
      ).toBeNull()
    })

    it("gives null for a datetime with an offset that falls outside the years 0000 to 9999", () => {
      expect(
        call("eq", [field("dt"), field("dt")], {
          dt: "0000-01-01T00:00:00+01:00",
        })
      ).toBeNull()
      expect(
        call("eq", [field("dt"), field("dt")], {
          dt: "9999-12-31T23:00:00-01:00",
        })
      ).toBeNull()
      expect(
        call("eq", [field("dt"), "0000-01-01T00:00:00+01:00"], {
          dt: "2024-01-01T00:00:00Z",
        })
      ).toBeNull()
    })

    it("gives the current date and ages", () => {
      expect(call("today", [])).toBe("2024-06-15")
      expect(call("today", [], {}, "Pacific/Kiritimati")).toBe("2024-06-16")
      expect(call("age", ["2000-06-15"])).toBe(24)
      expect(call("age", ["2000-06-16"])).toBe(23)
      expect(call("age", ["2030-06-16"])).toBe(-6)
      expect(
        call(
          "age",
          [field("dt")],
          { dt: "2000-06-16T00:00:00+14:00" },
          "Pacific/Kiritimati"
        )
      ).toBe(24)
    })

    it("gives null when a date argument is null", () => {
      for (const [name, rest] of [
        ["datePart", ["year"]],
        ["dateTrunc", ["year"]],
        ["addDays", [1]],
        ["age", []],
      ] as const) {
        expect(call(name, [field("d"), ...rest]), name).toBeNull()
      }
      expect(call("dateDiff", ["2024-01-01", field("d"), "days"])).toBeNull()
      expect(call("addDays", ["2024-01-01", field("i")])).toBeNull()
    })
  })
})
