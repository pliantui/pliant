/**
 * Multiplies by 2 to the power of `exponent` in two steps, each of which
 * stays within the range of doubles.
 */
export function scaleBy(x: number, exponent: number) {
  const half = Math.trunc(exponent / 2)
  return x * 2 ** half * 2 ** (exponent - half)
}

/**
 * The units a running statistic is kept in: a power of two near the largest
 * magnitude it has seen, so that values stay near 1 and neither overflow nor
 * underflow on the way. Units only grow, as larger values arrive, and `grow`
 * is then called with the exponent to multiply what the statistic holds by.
 * Moving to larger units is exact except for bits far below the largest
 * value, which no allowance can see.
 *
 * Units start at `initial`, or, without it, at the first nonzero value, since
 * a statistic of zeros is the same in any units.
 */
export function createUnits(
  initial: number | undefined,
  grow: (by: number) => void
) {
  let exponent = initial
  let limit = 2 ** ((initial ?? -1075) + 1)
  // Scaling by 2^-exponent as two factors, each within the range of doubles.
  let first = 1
  let second = 1
  const set = (next: number) => {
    exponent = next
    limit = 2 ** (next + 1)
    const half = Math.trunc(-next / 2)
    first = 2 ** half
    second = 2 ** (-next - half)
  }
  if (initial !== undefined) {
    set(initial)
  }
  return {
    /** The exponent of the current units, 0 before any nonzero value. */
    exponent: () => exponent ?? 0,
    /** `x` in the units, which grow to hold it first if it's too large. */
    of(x: number) {
      if (Math.abs(x) >= limit) {
        const next = Math.floor(Math.log2(Math.abs(x)))
        if (exponent !== undefined) {
          grow(exponent - next)
        }
        set(next)
      }
      return x * first * second
    },
  }
}
