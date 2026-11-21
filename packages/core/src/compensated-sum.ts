import { createUnits, scaleBy } from "./scale"

/**
 * Accumulates a sum by Neumaier's compensated summation: its error is
 * bounded by the sum of the absolute values times twice the rounding unit,
 * at any number of values.
 */
export function createSum() {
  let sum = 0
  let compensation = 0
  return {
    add(x: number) {
      const total = sum + x
      compensation +=
        Math.abs(sum) >= Math.abs(x) ? sum - total + x : x - total + sum
      sum = total
    },
    /** Applies `by`, a multiplication by a power of two, to the sum. */
    scale(by: (x: number) => number) {
      sum = by(sum)
      compensation = by(compensation)
    },
    total: () => sum + compensation,
  }
}

/**
 * A compensated sum kept in units of a power of two near the largest value
 * so far, as `createUnits` keeps them, so values that would overflow it
 * can't, and `total` overflows only when the sum itself is out of range.
 * Growing the units drops only bits below the new largest value's allowance.
 */
export function createScaledSum() {
  const sum = createSum()
  const units = createUnits(0, (by) => {
    sum.scale((x) => scaleBy(x, by))
  })
  return {
    add: (x: number) => {
      sum.add(units.of(x))
    },
    total: () => scaleBy(sum.total(), units.exponent()),
  }
}
