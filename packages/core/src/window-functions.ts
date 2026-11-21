import type { FunctionName } from "@pliantui/contract"

import { isFunctionName } from "./check-function-call"
import { createScaledSum, createSum } from "./compensated-sum"
import { createMoments } from "./moments"
import { finite, type Value } from "./read-value"
import { compareValues } from "./row-functions"
import { scaleBy } from "./scale"

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

/**
 * The numbers among the values, multiplied by the power of two that brings
 * the largest magnitude near 1, with NaN for null. Shares and scores don't
 * change with the scale, and scaling is exact except for values so far below
 * the largest that their allowances can't see them. It keeps sums of huge
 * values from overflowing and squares of tiny ones from underflowing.
 */
function normalize(values: readonly Value[]) {
  let largest = 0
  for (const value of values) {
    if (typeof value === "number") {
      largest = Math.max(largest, Math.abs(value))
    }
  }
  const exponent =
    largest === 0 ? 0 : Math.min(1023, Math.floor(Math.log2(largest)))
  return Float64Array.from(values, (value) =>
    typeof value === "number" ? scaleBy(value, -exponent) : Number.NaN
  )
}

const numeric =
  (compute: (xs: Float64Array) => (x: number) => number): CreateWindow =>
  () =>
  (values) => {
    const xs = normalize(values)
    const results = values.map((): Value => null)
    const resultOf = compute(xs)
    xs.forEach((x, index) => {
      if (!Number.isNaN(x)) {
        results[index] = finite(resultOf(x))
      }
    })
    return results
  }

// The sum is kept in units of a power of two near the largest value so far,
// so huge values can't overflow it on the way. A row's allowance counts only
// the values up to it, so the scale grows only as larger values arrive, and
// growing it drops only bits below the new allowance.
const runningSum: CreateWindow = () => (values, displayOrder) => {
  const results = values.map((): Value => null)
  const sum = createScaledSum()
  for (const index of displayOrder()) {
    const x = values[index] ?? null
    if (typeof x === "number") {
      sum.add(x)
      results[index] = finite(sum.total())
    }
  }
  return results
}

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
