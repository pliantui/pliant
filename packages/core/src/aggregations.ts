import type { FunctionName } from "@pliantui/contract"

import { isFunctionName } from "./check-function-call"
import { createMoments, type Moments } from "./moments"
import type { Value } from "./read-value"
import { compareValues } from "./row-functions"

/** Accumulates one aggregate function call over the rows of a group. */
export interface Aggregation {
  /** Adds a row, by the values of the call's arguments for it. */
  readonly add: (args: readonly Value[]) => void
  readonly result: () => Value
}

/** Creates an aggregation, given a `percentile`'s constant `p`. */
type CreateAggregation = (p: number) => Aggregation

// Arguments are type-checked against the function catalog before a call, so
// the catalog's argument types hold here. Dates and datetimes are numbers.
const isNumber = (value: Value) => typeof value === "number"

const counting =
  (counts: (args: readonly Value[]) => boolean): CreateAggregation =>
  () => {
    let count = 0
    return {
      add: (args) => {
        if (counts(args)) {
          count++
        }
      },
      result: () => count,
    }
  }

// Neumaier's compensated summation: its error is bounded by the sum of the
// absolute values times twice the rounding unit, at any number of values.
const summing =
  (counts: (args: readonly Value[]) => boolean): CreateAggregation =>
  () => {
    let sum = 0
    let compensation = 0
    return {
      add: (args) => {
        const [x = null] = args
        if (!isNumber(x) || !counts(args)) {
          return
        }
        const total = sum + x
        compensation +=
          Math.abs(sum) >= Math.abs(x) ? sum - total + x : x - total + sum
        sum = total
      },
      result: () => sum + compensation,
    }
  }

const fromMoments =
  (compute: (moments: Moments) => number | null): CreateAggregation =>
  () => {
    const moments = createMoments()
    return {
      add: ([x = null]) => {
        if (isNumber(x)) {
          moments.add(x)
        }
      },
      result: () => compute(moments.moments()),
    }
  }

const variance = (minimum: number, divisor: (count: number) => number) =>
  fromMoments(({ count, m2 }) => (count < minimum ? null : m2 / divisor(count)))

const deviation = (minimum: number, divisor: (count: number) => number) =>
  fromMoments(({ count, m2 }) =>
    count < minimum ? null : Math.sqrt(m2 / divisor(count))
  )

const sample = (count: number) => count - 1
const population = (count: number) => count

const picking =
  (keeps: (value: Value, kept: Value) => boolean): CreateAggregation =>
  () => {
    let kept: Value = null
    return {
      add: ([x = null]) => {
        if (x !== null && (kept === null || keeps(x, kept))) {
          kept = x
        }
      },
      result: () => kept,
    }
  }

const percentile: CreateAggregation = (p) => {
  const values: number[] = []
  return {
    add: ([x = null]) => {
      if (isNumber(x)) {
        values.push(x)
      }
    },
    result: () => {
      if (values.length === 0) {
        return null
      }
      const sorted = Float64Array.from(values).sort()
      const position = p * (sorted.length - 1)
      const index = Math.floor(position)
      const fraction = position - index
      const low = sorted[index] ?? 0
      const high = sorted[index + 1] ?? low
      // Weighting each neighbour, rather than adding a fraction of their
      // difference, can't overflow.
      return fraction === 0 ? low : low * (1 - fraction) + high * fraction
    },
  }
}

const mode: CreateAggregation = () => {
  const counts = new Map<Value, number>()
  return {
    add: ([x = null]) => {
      if (x !== null) {
        counts.set(x, (counts.get(x) ?? 0) + 1)
      }
    },
    result: () => {
      let best: Value = null
      let most = 0
      for (const [value, count] of counts) {
        if (
          count > most ||
          (count === most && compareValues(value, best) < 0)
        ) {
          best = value
          most = count
        }
      }
      return best
    },
  }
}

const distinctCount: CreateAggregation = () => {
  const values = new Set<Value>()
  return {
    add: ([x = null]) => {
      if (x !== null) {
        values.add(x)
      }
    },
    result: () => values.size,
  }
}

const aggregations: Partial<Record<FunctionName, CreateAggregation>> = {
  count: counting((args) => args.length === 0 || args[0] !== null),
  countIf: counting(([condition]) => condition === true),
  sum: summing(() => true),
  sumIf: summing(([, condition]) => condition === true),
  mean: fromMoments(({ count, mean }) => (count === 0 ? null : mean)),
  min: picking((value, kept) => compareValues(value, kept) < 0),
  max: picking((value, kept) => compareValues(value, kept) > 0),
  variance: variance(2, sample),
  stddev: deviation(2, sample),
  variancePop: variance(1, population),
  stddevPop: deviation(1, population),
  median: () => percentile(0.5),
  percentile,
  mode,
  distinctCount,
  first: picking(() => false),
  last: picking(() => true),
}

/** The built-in aggregate function of this name. */
export function aggregationOf(name: string): CreateAggregation | undefined {
  return isFunctionName(name) ? aggregations[name] : undefined
}
