/**
 * The mergeable summary of a set of numbers that their mean and variance
 * come from: how many there are, their mean, and the sum of their squared
 * deviations from the mean.
 */
export interface Moments {
  readonly count: number
  readonly mean: number
  readonly m2: number
}

/**
 * The moments of two sets of numbers together, by Chan's parallel
 * algorithm. Unlike a merge of sums of squares, it doesn't cancel
 * catastrophically when the values are large and their variance small.
 */
export function mergeMoments(a: Moments, b: Moments): Moments {
  if (a.count === 0) {
    return b
  }
  if (b.count === 0) {
    return a
  }
  const count = a.count + b.count
  const delta = b.mean - a.mean
  return {
    count,
    mean: a.mean + delta * (b.count / count),
    m2: a.m2 + b.m2 + delta * delta * ((a.count * b.count) / count),
  }
}

// Welford's updates add rounding errors in proportion to the number of
// values. Keeping each run short and merging the runs pairwise keeps the
// error in proportion to its logarithm, at any number of values.
const runLength = 64

/**
 * Accumulates moments one value at a time: by Welford's algorithm within a
 * run of values, and by `mergeMoments` across runs, pairwise.
 */
export function createMoments() {
  let count = 0
  let mean = 0
  let m2 = 0
  // Merged runs, each twice the size of the one after it, as in a binary
  // counter.
  const merged: { moments: Moments; level: number }[] = []

  return {
    add(x: number) {
      count++
      const delta = x - mean
      mean += delta / count
      m2 += delta * (x - mean)
      if (count === runLength) {
        let moments: Moments = { count, mean, m2 }
        let level = 0
        for (
          let top = merged.at(-1);
          top?.level === level;
          top = merged.at(-1)
        ) {
          merged.pop()
          moments = mergeMoments(top.moments, moments)
          level++
        }
        merged.push({ moments, level })
        count = 0
        mean = 0
        m2 = 0
      }
    },
    moments(): Moments {
      return merged.reduceRight(
        (later, { moments }) => mergeMoments(moments, later),
        { count, mean, m2 }
      )
    },
  }
}
