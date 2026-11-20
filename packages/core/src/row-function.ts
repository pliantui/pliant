import type { ValueType } from "./expression-types"
import type { Value } from "./read-value"
import type { TimeZone } from "./time-zone"

/** What a row function knows about one call. */
export interface Call {
  /** The type each argument is read as. */
  readonly types: readonly (ValueType | undefined)[]
  /** The dataset's time zone, which dates and datetimes are read in. */
  readonly zone: TimeZone
  /** The current date, as a day counted from 1970-01-01. */
  readonly today: () => number
}

/**
 * Computes a row function from its arguments. A function whose catalog entry
 * propagates nulls is called only when no argument is null. A NaN or
 * infinite result is null.
 */
export type RowFunction = (args: readonly Value[], call: Call) => Value
