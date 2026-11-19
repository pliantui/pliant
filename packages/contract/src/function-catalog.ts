type ValueType = "number" | "string" | "boolean" | "date" | "datetime"

interface SameAs {
  /** The name of an earlier argument whose type this one takes. */
  readonly like: string
}

interface FunctionArg {
  readonly name: string
  /** One type, the types it accepts, or the type of an earlier argument. */
  readonly type: ValueType | readonly ValueType[] | SameAs
  /** Only the last arguments can be optional. */
  readonly optional?: true
  /** Only the last argument can be variadic. It takes one or more values. */
  readonly variadic?: true
  /** The argument must be a `{ value }` node. */
  readonly constant?: true
  /** The argument must be a `{ value }` node holding one of these strings. */
  readonly values?: readonly string[]
}

type Summary = "count" | "sum" | "mean" | "m2" | "min" | "max"

export interface FunctionDefinition {
  /**
   * `row` reads one row. `aggregate` reads every row of a group and its
   * arguments are row expressions. `window` gives each row a value computed
   * over its partition: the row's group when the table is grouped, otherwise
   * every row after filters.
   */
  readonly kind: "row" | "aggregate" | "window"
  readonly args: readonly FunctionArg[]
  readonly returns: ValueType | SameAs
  /**
   * `propagate`: a null argument makes the result null. `skip`: null values
   * are left out, and a window function gives their rows null. `custom`: as
   * `describe` says.
   */
  readonly nulls: "propagate" | "skip" | "custom"
  /**
   * The summary an aggregate is merged from across partitions, or `null` when
   * it can't be merged. Counts and sums add, minimums and maximums combine,
   * and `mean` and `m2` merge with `count` by Chan's parallel algorithm.
   */
  readonly mergeable: readonly Summary[] | null
  /** Whether server adapters compile it to SQL. */
  readonly sql: boolean
  /** The documented semantics, also given to the model. */
  readonly describe: string
}

const comparable = ["number", "string", "date", "datetime"] as const
const anyType = ["number", "string", "boolean", "date", "datetime"] as const
const dates = ["date", "datetime"] as const

function row(
  args: FunctionArg[],
  returns: FunctionDefinition["returns"],
  describe: string,
  nulls: "propagate" | "custom" = "propagate"
): FunctionDefinition {
  return {
    kind: "row",
    args,
    returns,
    nulls,
    mergeable: null,
    sql: true,
    describe,
  }
}

const builtins = {
  add: row(
    [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    "number",
    "a plus b."
  ),
  sub: row(
    [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    "number",
    "a minus b."
  ),
  mul: row(
    [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    "number",
    "a times b."
  ),
  div: row(
    [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    "number",
    "a divided by b, or null when b is 0."
  ),
  abs: row(
    [{ name: "x", type: "number" }],
    "number",
    "The absolute value of x."
  ),
  round: row(
    [
      { name: "x", type: "number" },
      { name: "digits", type: "number", optional: true },
    ],
    "number",
    "x rounded to a whole number of decimal digits (default 0), halves away from zero. Fractional digits are truncated toward zero."
  ),
  floor: row(
    [{ name: "x", type: "number" }],
    "number",
    "The largest whole number not greater than x."
  ),
  ceil: row(
    [{ name: "x", type: "number" }],
    "number",
    "The smallest whole number not less than x."
  ),
  min2: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    { like: "a" },
    "The smaller of a and b."
  ),
  max2: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    { like: "a" },
    "The larger of a and b."
  ),
  clamp: row(
    [
      { name: "x", type: "number" },
      { name: "low", type: "number" },
      { name: "high", type: "number" },
    ],
    "number",
    "x limited to the range from low to high, or null when low is greater than high."
  ),
  percentChange: row(
    [
      { name: "from", type: "number" },
      { name: "to", type: "number" },
    ],
    "number",
    "(to - from) / from as a fraction (0.12 is 12%), or null when from is 0."
  ),
  if: row(
    [
      { name: "condition", type: "boolean" },
      { name: "then", type: anyType },
      { name: "else", type: { like: "then" } },
    ],
    { like: "then" },
    "then when condition is true, otherwise else. A null condition picks else.",
    "custom"
  ),
  and: row(
    [
      { name: "a", type: "boolean" },
      { name: "b", type: "boolean", variadic: true },
    ],
    "boolean",
    "True when every argument is true. False when any is false, even if others are null; otherwise null.",
    "custom"
  ),
  or: row(
    [
      { name: "a", type: "boolean" },
      { name: "b", type: "boolean", variadic: true },
    ],
    "boolean",
    "True when any argument is true, even if others are null. False when every one is false; otherwise null.",
    "custom"
  ),
  not: row(
    [{ name: "x", type: "boolean" }],
    "boolean",
    "True when x is false."
  ),
  eq: row(
    [
      { name: "a", type: anyType },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a equals b. Strings compare exactly, case included."
  ),
  neq: row(
    [
      { name: "a", type: anyType },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a doesn't equal b. Strings compare exactly, case included."
  ),
  gt: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a is greater than b. Strings compare by code point, dates by time."
  ),
  gte: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a is greater than or equal to b. Strings compare by code point, dates by time."
  ),
  lt: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a is less than b. Strings compare by code point, dates by time."
  ),
  lte: row(
    [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    "boolean",
    "True when a is less than or equal to b. Strings compare by code point, dates by time."
  ),
  between: row(
    [
      { name: "x", type: comparable },
      { name: "low", type: { like: "x" } },
      { name: "high", type: { like: "x" } },
    ],
    "boolean",
    "True when x is from low to high, both included."
  ),
  in: row(
    [
      { name: "x", type: anyType },
      { name: "values", type: { like: "x" }, variadic: true },
    ],
    "boolean",
    "True when x equals one of values. Null when x is null; null values never match.",
    "custom"
  ),
  isNull: row(
    [{ name: "x", type: anyType }],
    "boolean",
    "True when x is null, otherwise false.",
    "custom"
  ),
  coalesce: row(
    [
      { name: "x", type: anyType },
      { name: "fallbacks", type: { like: "x" }, variadic: true },
    ],
    { like: "x" },
    "The first argument that isn't null, or null when all are.",
    "custom"
  ),
  concat: row(
    [
      { name: "a", type: "string" },
      { name: "b", type: "string", variadic: true },
    ],
    "string",
    "The arguments joined into one string. Null arguments count as empty strings.",
    "custom"
  ),
  lower: row(
    [{ name: "text", type: "string" }],
    "string",
    "text in lowercase, by Unicode's default case mapping."
  ),
  upper: row(
    [{ name: "text", type: "string" }],
    "string",
    "text in uppercase, by Unicode's default case mapping."
  ),
  length: row(
    [{ name: "text", type: "string" }],
    "number",
    "The number of Unicode code points in text."
  ),
  contains: row(
    [
      { name: "text", type: "string" },
      { name: "search", type: "string" },
    ],
    "boolean",
    "True when text contains search, case included."
  ),
  startsWith: row(
    [
      { name: "text", type: "string" },
      { name: "search", type: "string" },
    ],
    "boolean",
    "True when text starts with search, case included."
  ),
  left: row(
    [
      { name: "text", type: "string" },
      { name: "count", type: "number" },
    ],
    "string",
    "The first count code points of text."
  ),
  right: row(
    [
      { name: "text", type: "string" },
      { name: "count", type: "number" },
    ],
    "string",
    "The last count code points of text."
  ),
  dateDiff: row(
    [
      { name: "start", type: dates },
      { name: "end", type: dates },
      {
        name: "unit",
        type: "string",
        values: ["days", "weeks", "months", "years"],
      },
    ],
    "number",
    "The whole calendar units from start to end, negative when end is earlier, counted between dates in the dataset's time zone."
  ),
  datePart: row(
    [
      { name: "date", type: dates },
      {
        name: "part",
        type: "string",
        values: ["year", "quarter", "month", "week", "weekday", "day"],
      },
    ],
    "number",
    "One part of the date in the dataset's time zone. week is the ISO week number, weekday runs from 1 (Monday) to 7 (Sunday), and day is the day of the month."
  ),
  dateTrunc: row(
    [
      { name: "date", type: dates },
      {
        name: "unit",
        type: "string",
        values: ["day", "week", "month", "quarter", "year"],
      },
    ],
    "date",
    "The first day of the unit that contains the date in the dataset's time zone. Weeks start on Monday."
  ),
  addDays: row(
    [
      { name: "date", type: dates },
      { name: "days", type: "number" },
    ],
    { like: "date" },
    "date moved by days calendar days in the dataset's time zone. Fractional days are truncated toward zero."
  ),
  today: row(
    [],
    "date",
    "The current date: in the dataset's time zone for org and team layers, and in the viewer's time zone for personal and session layers."
  ),
  age: row(
    [{ name: "date", type: dates }],
    "number",
    "The whole years from date to today, as today defines it."
  ),
  count: {
    kind: "aggregate",
    args: [{ name: "x", type: anyType, optional: true }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count"],
    sql: true,
    describe:
      "The number of values of x that aren't null, or of rows without x.",
  },
  countIf: {
    kind: "aggregate",
    args: [{ name: "condition", type: "boolean" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count"],
    sql: true,
    describe: "The number of rows where condition is true.",
  },
  sum: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["sum"],
    sql: true,
    describe: "The sum of x, or 0 when there are no values.",
  },
  sumIf: {
    kind: "aggregate",
    args: [
      { name: "x", type: "number" },
      { name: "condition", type: "boolean" },
    ],
    returns: "number",
    nulls: "skip",
    mergeable: ["sum"],
    sql: true,
    describe:
      "The sum of x over rows where condition is true, or 0 when there are none.",
  },
  mean: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count", "mean"],
    sql: true,
    describe: "The arithmetic mean of x, or null when there are no values.",
  },
  min: {
    kind: "aggregate",
    args: [{ name: "x", type: comparable }],
    returns: { like: "x" },
    nulls: "skip",
    mergeable: ["min"],
    sql: true,
    describe: "The smallest value of x, or null when there are no values.",
  },
  max: {
    kind: "aggregate",
    args: [{ name: "x", type: comparable }],
    returns: { like: "x" },
    nulls: "skip",
    mergeable: ["max"],
    sql: true,
    describe: "The largest value of x, or null when there are no values.",
  },
  variance: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count", "mean", "m2"],
    sql: true,
    describe:
      "The sample variance of x (divides by n - 1), or null with fewer than 2 values.",
  },
  stddev: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count", "mean", "m2"],
    sql: true,
    describe:
      "The sample standard deviation of x (divides by n - 1), or null with fewer than 2 values.",
  },
  variancePop: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count", "mean", "m2"],
    sql: true,
    describe:
      "The population variance of x (divides by n), or null when there are no values.",
  },
  stddevPop: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: ["count", "mean", "m2"],
    sql: true,
    describe:
      "The population standard deviation of x (divides by n), or null when there are no values.",
  },
  median: {
    kind: "aggregate",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "The middle value of x, the mean of the two middle values when their number is even, or null when there are no values.",
  },
  percentile: {
    kind: "aggregate",
    args: [
      { name: "x", type: "number" },
      { name: "p", type: "number", constant: true },
    ],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "The p-th quantile of x for p from 0 to 1, interpolated linearly between the nearest values. Null when there are no values or p is outside 0 to 1.",
  },
  mode: {
    kind: "aggregate",
    args: [{ name: "x", type: anyType }],
    returns: { like: "x" },
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "The most frequent value of x; on a tie, the one that sorts first. Null when there are no values.",
  },
  distinctCount: {
    kind: "aggregate",
    args: [{ name: "x", type: anyType }],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: true,
    describe: "The number of distinct values of x.",
  },
  first: {
    kind: "aggregate",
    args: [{ name: "x", type: anyType }],
    returns: { like: "x" },
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "The first value of x in the current sort order, or null when there are no values.",
  },
  last: {
    kind: "aggregate",
    args: [{ name: "x", type: anyType }],
    returns: { like: "x" },
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "The last value of x in the current sort order, or null when there are no values.",
  },
  rank: {
    kind: "window",
    args: [
      { name: "x", type: comparable },
      {
        name: "order",
        type: "string",
        values: ["desc", "asc"],
        optional: true,
      },
    ],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: true,
    describe:
      "1 plus the number of rows in the partition whose x comes before this row's, largest first unless order is asc. Ties share a rank and leave gaps (1, 2, 2, 4).",
  },
  denseRank: {
    kind: "window",
    args: [
      { name: "x", type: comparable },
      {
        name: "order",
        type: "string",
        values: ["desc", "asc"],
        optional: true,
      },
    ],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: true,
    describe:
      "The number of distinct values of x in the partition that come before this row's, plus 1, largest first unless order is asc. Ties share a rank without gaps (1, 2, 2, 3).",
  },
  runningSum: {
    kind: "window",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: true,
    describe:
      "The sum of x over the partition's rows up to and including this one, in the current sort order.",
  },
  share: {
    kind: "window",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: true,
    describe:
      "x as a fraction of the partition's sum of x (0.12 is 12%), or null when that sum is 0.",
  },
  zScore: {
    kind: "window",
    args: [{ name: "x", type: "number" }],
    returns: "number",
    nulls: "skip",
    mergeable: null,
    sql: false,
    describe:
      "(x - mean) / sample standard deviation over the partition, or null when the deviation is 0 or there are fewer than 2 values.",
  },
} satisfies Record<string, FunctionDefinition>

export type FunctionName = keyof typeof builtins

export const functionCatalog: Readonly<
  Record<FunctionName, FunctionDefinition>
> = builtins
