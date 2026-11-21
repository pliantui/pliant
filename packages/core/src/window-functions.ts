import type { FunctionName } from "@pliantui/contract"

import { isFunctionName } from "./check-function-call"
import { createSum } from "./compensated-sum"
import { createMoments } from "./moments"
import { finite, type Value } from "./read-value"
import { compareValues } from "./row-functions"

/**
 * Computes a window function call for every row of a partition, from the
 * value of its argument for each row. `displayOrder` gives the rows'
 * indices in display order.
 */
export type WindowFunction = (
  values: readonly Value[],
  displayOrder: () => readonly number[]
) => Value[]

/** Creates a window function, given a ranking's constant `order`. */
type CreateWindow = (ascending: boolean) => WindowFunction

const ranking =
  (dense: boolean): CreateWindow =>
  (ascending) =>
  (values) => {
    const results = values.map((): Value => null)
    const ranked: { value: Value; index: number }[] = []
    values.forEach((value, index) => {
      if (value !== null) {
        ranked.push({ value, index })
      }
    })
    const direction = ascending ? 1 : -1
    ranked.sort((a, b) => direction * compareValues(a.value, b.value))
    let rank = 0
    ranked.forEach(({ value, index }, position) => {
      const previous = ranked[position - 1]
      if (!previous || compareValues(previous.value, value) !== 0) {
        rank = dense ? rank + 1 : position + 1
      }
      results[index] = rank
    })
    return results
  }

// Multiplies by 2 to the power of exponent in two steps, each of which stays
// within the range of doubles.
function scaleBy(x: number, exponent: number) {
  const half = Math.trunc(exponent / 2)
  return x * 2 ** half * 2 ** (exponent - half)
}

/**
 * The numbers among the values, multiplied by the power of two that brings
 * the largest magnitude near 1, with NaN for null, and that exponent.
 * Scaling by a power of two is exact, except for values so far below the
 * largest that the allowances can't see them, and it keeps sums of huge
 * values from overflowing and squares of tiny ones from underflowing.
 */
function normalize(values: readonly Value[]) {
  let largest = 0
  for (const value of values) {
    if (typeof value === "number") {
      largest = Math.max(largest, Math.abs(value))
    }
  }
  const exponent = largest === 0 ? 0 : Math.floor(Math.log2(largest))
  return {
    xs: Float64Array.from(values, (value) =>
      typeof value === "number" ? scaleBy(value, -exponent) : Number.NaN
    ),
    exponent,
  }
}

const numeric =
  (
    compute: (
      xs: Float64Array,
      exponent: number,
      displayOrder: () => readonly number[]
    ) => (x: number, index: number) => number
  ): CreateWindow =>
  () =>
  (values, displayOrder) => {
    const { xs, exponent } = normalize(values)
    const results = values.map((): Value => null)
    const resultOf = compute(xs, exponent, displayOrder)
    xs.forEach((x, index) => {
      if (!Number.isNaN(x)) {
        results[index] = finite(resultOf(x, index))
      }
    })
    return results
  }

const runningSum = numeric((xs, exponent, displayOrder) => {
  const sums = new Float64Array(xs.length)
  const sum = createSum()
  for (const index of displayOrder()) {
    const x = xs[index] ?? Number.NaN
    if (!Number.isNaN(x)) {
      sum.add(x)
      sums[index] = scaleBy(sum.total(), exponent)
    }
  }
  return (_, index) => sums[index] ?? Number.NaN
})

// Shares and scores don't change when every value is scaled, so they're
// computed from the scaled values as they are.
const share = numeric((xs) => {
  const sum = createSum()
  for (const x of xs) {
    if (!Number.isNaN(x)) {
      sum.add(x)
    }
  }
  const total = sum.total()
  // Dividing by a total of 0 gives an infinity or NaN, which is null.
  return (x) => x / total
})

const zScore = numeric((xs) => {
  const moments = createMoments()
  for (const x of xs) {
    if (!Number.isNaN(x)) {
      moments.add(x)
    }
  }
  const { count, mean, m2 } = moments.moments()
  // With one value the deviation is NaN, and with equal values it's 0 and
  // so is every distance from the mean, so the score is NaN, which is null.
  const deviation = Math.sqrt(m2 / (count - 1))
  return (x) => (x - mean) / deviation
})

const windows: Partial<Record<FunctionName, CreateWindow>> = {
  rank: ranking(false),
  denseRank: ranking(true),
  runningSum,
  share,
  zScore,
}

/** The built-in window function of this name. */
export function windowFunctionOf(name: string): CreateWindow | undefined {
  return isFunctionName(name) ? windows[name] : undefined
}
