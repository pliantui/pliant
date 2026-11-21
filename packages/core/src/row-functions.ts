import { functionSignatures, type FunctionName } from "@pliantui/contract"

import { isFunctionName } from "./check-function-call"
import { compareCodePoints, isSurrogate } from "./compare-code-points"
import { dateFunctions } from "./date-functions"
import type { Value } from "./read-value"
import type { RowFunction } from "./row-function"

type Args = readonly Value[]

// Arguments are type-checked against the function catalog before a call, so
// the catalog's argument types hold here. Dates and datetimes are numbers.
const numberAt = (args: Args, index: number) => args[index] as number
const stringAt = (args: Args, index: number) => args[index] as string

const numeric =
  (compute: (...values: number[]) => number | null): RowFunction =>
  (args) =>
    compute(...args.map((_, index) => numberAt(args, index)))

const textual =
  (compute: (text: string, other: string) => Value): RowFunction =>
  (args) =>
    compute(stringAt(args, 0), stringAt(args, 1))

/** Orders two values of one comparable type: by code point for strings. */
export function compareValues(a: Value, b: Value): number {
  return typeof a === "string" && typeof b === "string"
    ? compareCodePoints(a, b)
    : Number(a) - Number(b)
}

const comparison =
  (test: (order: number) => boolean): RowFunction =>
  ([a = null, b = null]) =>
    test(compareValues(a, b))

const pickBy =
  (test: (order: number) => boolean): RowFunction =>
  ([a = null, b = null]) =>
    test(compareValues(a, b)) ? a : b

/**
 * Rounds half away from zero on the shortest decimal that represents x, so
 * round(1.005, 2) is 1.01 although the double nearest 1.005 is below it.
 */
function round(x: number, digits: number) {
  const [mantissa = "", exponent = "0"] = String(Math.abs(x)).split("e")
  const [whole = "", fraction = ""] = mantissa.split(".")
  const all = whole + fraction
  const shift = Number(exponent) - fraction.length + digits
  if (shift >= 0) {
    return x
  }
  const keep = all.length + shift
  const kept =
    BigInt(all.slice(0, Math.max(keep, 0)) || "0") +
    ((all[keep] ?? "0") >= "5" ? 1n : 0n)
  return Math.sign(x) * Number(`${String(kept)}e${String(-digits)}`)
}

function codePoints(text: string) {
  return Array.from(text)
}

/** Whether the index falls between the two halves of a surrogate pair. */
function splitsPair(text: string, index: number) {
  return (
    isSurrogate(text.charCodeAt(index - 1), 0xd800) &&
    isSurrogate(text.charCodeAt(index), 0xdc00)
  )
}

// Matches by code point: a match can't start or end inside a surrogate pair.
function matchesAt(text: string, search: string, index: number) {
  return !splitsPair(text, index) && !splitsPair(text, index + search.length)
}

function contains(text: string, search: string) {
  for (
    let index = text.indexOf(search);
    index >= 0;
    index = text.indexOf(search, index + 1)
  ) {
    if (matchesAt(text, search, index)) {
      return true
    }
  }
  return false
}

function startsWith(text: string, search: string) {
  return text.startsWith(search) && matchesAt(text, search, 0)
}

// Lowercasing as `lower` does keeps containsI(a, b) equal to
// contains(lower(a), lower(b)), and likewise for eqI and startsWithI.
const ignoringCase =
  (test: (text: string, other: string) => boolean) =>
  (text: string, other: string) =>
    test(text.toLowerCase(), other.toLowerCase())

const rowFunctions: Partial<Record<FunctionName, RowFunction>> = {
  add: numeric((a, b) => a + b),
  sub: numeric((a, b) => a - b),
  mul: numeric((a, b) => a * b),
  // Dividing by 0 gives an infinite or NaN result, which is null.
  div: numeric((a, b) => a / b),
  abs: numeric(Math.abs),
  round: (args) =>
    round(numberAt(args, 0), args.length > 1 ? numberAt(args, 1) : 0),
  floor: numeric(Math.floor),
  ceil: numeric(Math.ceil),
  min2: pickBy((order) => order <= 0),
  max2: pickBy((order) => order >= 0),
  clamp: ([x = null, low = null, high = null]) =>
    compareValues(low, high) > 0
      ? null
      : compareValues(x, low) < 0
        ? low
        : compareValues(x, high) > 0
          ? high
          : x,
  percentChange: numeric((from, to) => (to - from) / Math.abs(from)),
  if: ([condition, then = null, otherwise = null]) =>
    condition === true ? then : otherwise,
  and: (args) =>
    args.includes(false) ? false : args.includes(null) ? null : true,
  or: (args) =>
    args.includes(true) ? true : args.includes(null) ? null : false,
  not: ([x]) => !x,
  eq: ([a, b]) => a === b,
  eqI: textual(ignoringCase((a, b) => a === b)),
  neq: ([a, b]) => a !== b,
  gt: comparison((order) => order > 0),
  gte: comparison((order) => order >= 0),
  lt: comparison((order) => order < 0),
  lte: comparison((order) => order <= 0),
  between: ([x = null, low = null, high = null]) =>
    compareValues(x, low) >= 0 && compareValues(x, high) <= 0,
  in: ([x = null, ...values]) => (x === null ? null : values.includes(x)),
  isNull: ([x]) => x === null,
  coalesce: (args) => args.find((arg) => arg !== null) ?? null,
  concat: (args) => args.map((arg) => arg ?? "").join(""),
  lower: textual((text) => text.toLowerCase()),
  upper: textual((text) => text.toUpperCase()),
  length: textual((text) => codePoints(text).length),
  contains: textual(contains),
  containsI: textual(ignoringCase(contains)),
  startsWith: textual(startsWith),
  startsWithI: textual(ignoringCase(startsWith)),
  left: (args) =>
    codePoints(stringAt(args, 0))
      .slice(0, Math.max(numberAt(args, 1), 0))
      .join(""),
  right: (args) => {
    const points = codePoints(stringAt(args, 0))
    return points
      .slice(Math.max(points.length - Math.max(numberAt(args, 1), 0), 0))
      .join("")
  },
  ...dateFunctions,
}

/**
 * The built-in row function of this name, and whether its catalog entry
 * propagates nulls. Aggregate and window functions have none.
 */
export function rowFunctionOf(name: string) {
  if (!isFunctionName(name)) {
    return undefined
  }
  const run = rowFunctions[name]
  return (
    run && {
      run,
      propagates: functionSignatures[name].nulls === "propagate",
    }
  )
}
