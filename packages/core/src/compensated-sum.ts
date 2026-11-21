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
