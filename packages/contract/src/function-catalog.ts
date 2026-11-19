type ValueType =
  "number" | "integer" | "string" | "boolean" | "date" | "datetime"

interface SameAs {
  /** The name of an earlier, non-variadic argument. */
  readonly like: string
}

type Returns =
  | ValueType
  | SameAs
  | {
      /** The unified type of these arguments, which needn't share a group. */
      readonly join: readonly string[]
    }
  | {
      /** `integer` when this constant argument is 0, otherwise `number`. */
      readonly integerWhenZero: string
    }

interface FunctionArg {
  readonly name: string
  /**
   * One type, the types it accepts, or `like` an earlier argument, which puts
   * both in one group whose types unify and whose units must match.
   */
  readonly type: ValueType | readonly ValueType[] | SameAs
  /** Only the last arguments can be optional. */
  readonly optional?: true
  /** The value of an optional argument that is left out. */
  readonly default?: string | number
  /** Only the last argument can be variadic. It takes one or more values. */
  readonly variadic?: true
  /** The argument must be a `{ value }` node. */
  readonly constant?: true
  /** The argument must be a `{ value }` node holding one of these strings. */
  readonly values?: readonly string[]
  /** The inclusive range a constant number must be in. */
  readonly range?: readonly [number, number]
}

type Summary = "count" | "sum" | "mean" | "m2" | "min" | "max"

/**
 * The shape of a built-in function. Functions registered under a namespace
 * (`acme:gpa`) get their own registration API.
 */
export interface FunctionDefinition {
  /**
   * `row` reads one row. `aggregate` reads every row of a group. `window`
   * gives each row a value computed over its partition.
   */
  readonly kind: "row" | "aggregate" | "window"
  readonly args: readonly FunctionArg[]
  readonly returns: Returns
  /**
   * The unit of a number result: `none`, `percent` (a fraction shown as a
   * percentage), `like` (the unit of an argument's group), or the unit rules
   * of multiplication (`product`) and division (`quotient`).
   */
  readonly unit: "none" | "percent" | "product" | "quotient" | SameAs
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
  /** The documented semantics, also given to the model. */
  readonly describe: string
}

type Definition = Pick<
  FunctionDefinition,
  "args" | "returns" | "unit" | "describe"
>

const comparable = ["number", "string", "date", "datetime"] as const
const anyType = ["number", "string", "boolean", "date", "datetime"] as const
const dates = ["date", "datetime"] as const

function define(
  kind: FunctionDefinition["kind"],
  { args, returns, unit, describe }: Definition,
  nulls: FunctionDefinition["nulls"],
  mergeable: FunctionDefinition["mergeable"]
): FunctionDefinition {
  return { kind, args, returns, unit, nulls, mergeable, describe }
}

function rowFunction(
  definition: Definition,
  nulls: "propagate" | "custom" = "propagate"
): FunctionDefinition {
  return define("row", definition, nulls, null)
}

function aggregate(
  definition: Definition,
  mergeable: readonly Summary[] | null
): FunctionDefinition {
  return define("aggregate", definition, "skip", mergeable)
}

function windowFunction(definition: Definition): FunctionDefinition {
  return define("window", definition, "skip", null)
}

function comparison(describe: string): FunctionDefinition {
  return rowFunction({
    args: [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    returns: "boolean",
    unit: "none",
    describe,
  })
}

function textTest(describe: string): FunctionDefinition {
  return rowFunction({
    args: [
      { name: "text", type: "string" },
      { name: "search", type: "string" },
    ],
    returns: "boolean",
    unit: "none",
    describe,
  })
}

function statistic(
  returnsUnit: "none" | SameAs,
  mergeable: readonly Summary[] | null,
  describe: string
): FunctionDefinition {
  return aggregate(
    {
      args: [{ name: "x", type: "number" }],
      returns: "number",
      unit: returnsUnit,
      describe,
    },
    mergeable
  )
}

function pick(describe: string): FunctionDefinition {
  return aggregate(
    {
      args: [{ name: "x", type: anyType }],
      returns: { like: "x" },
      unit: { like: "x" },
      describe,
    },
    null
  )
}

function ranking(describe: string): FunctionDefinition {
  return windowFunction({
    args: [
      { name: "x", type: comparable },
      {
        name: "order",
        type: "string",
        optional: true,
        default: "desc",
        values: ["desc", "asc"],
      },
    ],
    returns: "integer",
    unit: "none",
    describe,
  })
}

const builtins = {
  add: rowFunction({
    args: [
      { name: "a", type: "number" },
      { name: "b", type: { like: "a" } },
    ],
    returns: { like: "a" },
    unit: { like: "a" },
    describe: "a plus b.",
  }),
  sub: rowFunction({
    args: [
      { name: "a", type: "number" },
      { name: "b", type: { like: "a" } },
    ],
    returns: { like: "a" },
    unit: { like: "a" },
    describe: "a minus b.",
  }),
  mul: rowFunction({
    args: [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    returns: { join: ["a", "b"] },
    unit: "product",
    describe: "a times b.",
  }),
  div: rowFunction({
    args: [
      { name: "a", type: "number" },
      { name: "b", type: "number" },
    ],
    returns: "number",
    unit: "quotient",
    describe: "a divided by b, or null when b is 0.",
  }),
  abs: rowFunction({
    args: [{ name: "x", type: "number" }],
    returns: { like: "x" },
    unit: { like: "x" },
    describe: "The absolute value of x.",
  }),
  round: rowFunction({
    args: [
      { name: "x", type: "number" },
      {
        name: "digits",
        type: "integer",
        optional: true,
        default: 0,
        constant: true,
        range: [0, 10],
      },
    ],
    returns: { integerWhenZero: "digits" },
    unit: { like: "x" },
    describe:
      "x rounded to digits decimal places, halves away from zero, applied to the shortest decimal that represents x, so round(1.005, 2) is 1.01.",
  }),
  floor: rowFunction({
    args: [{ name: "x", type: "number" }],
    returns: "integer",
    unit: { like: "x" },
    describe: "The largest integer not greater than x.",
  }),
  ceil: rowFunction({
    args: [{ name: "x", type: "number" }],
    returns: "integer",
    unit: { like: "x" },
    describe: "The smallest integer not less than x.",
  }),
  min2: rowFunction({
    args: [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    returns: { like: "a" },
    unit: { like: "a" },
    describe: "The smaller of a and b, or null when either is null.",
  }),
  max2: rowFunction({
    args: [
      { name: "a", type: comparable },
      { name: "b", type: { like: "a" } },
    ],
    returns: { like: "a" },
    unit: { like: "a" },
    describe: "The larger of a and b, or null when either is null.",
  }),
  clamp: rowFunction({
    args: [
      { name: "x", type: "number" },
      { name: "low", type: { like: "x" } },
      { name: "high", type: { like: "x" } },
    ],
    returns: { like: "x" },
    unit: { like: "x" },
    describe:
      "x limited to the range from low to high, or null when low is greater than high.",
  }),
  percentChange: rowFunction({
    args: [
      { name: "from", type: "number" },
      { name: "to", type: { like: "from" } },
    ],
    returns: "number",
    unit: "percent",
    describe:
      "(to - from) divided by the absolute value of from, so a rise is positive even from a negative base. Null when from is 0.",
  }),
  if: rowFunction(
    {
      args: [
        { name: "condition", type: "boolean" },
        { name: "then", type: anyType },
        { name: "else", type: { like: "then" } },
      ],
      returns: { like: "then" },
      unit: { like: "then" },
      describe:
        "then when condition is true, otherwise else. A null condition picks else.",
    },
    "custom"
  ),
  and: rowFunction(
    {
      args: [
        { name: "a", type: "boolean" },
        { name: "b", type: "boolean", variadic: true },
      ],
      returns: "boolean",
      unit: "none",
      describe:
        "True when every argument is true. False when any is false, even if others are null; otherwise null.",
    },
    "custom"
  ),
  or: rowFunction(
    {
      args: [
        { name: "a", type: "boolean" },
        { name: "b", type: "boolean", variadic: true },
      ],
      returns: "boolean",
      unit: "none",
      describe:
        "True when any argument is true, even if others are null. False when every one is false; otherwise null.",
    },
    "custom"
  ),
  not: rowFunction({
    args: [{ name: "x", type: "boolean" }],
    returns: "boolean",
    unit: "none",
    describe: "True when x is false, false when x is true.",
  }),
  eq: rowFunction({
    args: [
      { name: "a", type: anyType },
      { name: "b", type: { like: "a" } },
    ],
    returns: "boolean",
    unit: "none",
    describe: "True when a equals b.",
  }),
  neq: rowFunction({
    args: [
      { name: "a", type: anyType },
      { name: "b", type: { like: "a" } },
    ],
    returns: "boolean",
    unit: "none",
    describe: "True when a doesn't equal b.",
  }),
  gt: comparison("True when a is greater than b."),
  gte: comparison("True when a is greater than or equal to b."),
  lt: comparison("True when a is less than b."),
  lte: comparison("True when a is less than or equal to b."),
  between: rowFunction({
    args: [
      { name: "x", type: comparable },
      { name: "low", type: { like: "x" } },
      { name: "high", type: { like: "x" } },
    ],
    returns: "boolean",
    unit: "none",
    describe:
      "True when x is from low to high, both included. False when low is greater than high.",
  }),
  in: rowFunction(
    {
      args: [
        { name: "x", type: anyType },
        { name: "values", type: { like: "x" }, variadic: true },
      ],
      returns: "boolean",
      unit: "none",
      describe:
        "True when x equals one of values, otherwise false. Null when x is null; null values never match. Takes at most 15 values, by the 16-argument limit.",
    },
    "custom"
  ),
  isNull: rowFunction(
    {
      args: [{ name: "x", type: anyType }],
      returns: "boolean",
      unit: "none",
      describe: "True when x is null, otherwise false.",
    },
    "custom"
  ),
  coalesce: rowFunction(
    {
      args: [
        { name: "x", type: anyType },
        { name: "fallbacks", type: { like: "x" }, variadic: true },
      ],
      returns: { like: "x" },
      unit: { like: "x" },
      describe: "The first argument that isn't null, or null when all are.",
    },
    "custom"
  ),
  concat: rowFunction(
    {
      args: [
        { name: "a", type: "string" },
        { name: "b", type: "string", variadic: true },
      ],
      returns: "string",
      unit: "none",
      describe:
        "The arguments joined into one string, with null arguments as empty strings. Never null.",
    },
    "custom"
  ),
  lower: rowFunction({
    args: [{ name: "text", type: "string" }],
    returns: "string",
    unit: "none",
    describe: "text in lowercase, by Unicode's default case mapping.",
  }),
  upper: rowFunction({
    args: [{ name: "text", type: "string" }],
    returns: "string",
    unit: "none",
    describe: "text in uppercase, by Unicode's default case mapping.",
  }),
  length: rowFunction({
    args: [{ name: "text", type: "string" }],
    returns: "integer",
    unit: "none",
    describe: "The number of code points in text.",
  }),
  contains: textTest("True when search occurs in text."),
  startsWith: textTest("True when text starts with search."),
  left: rowFunction({
    args: [
      { name: "text", type: "string" },
      { name: "count", type: "integer" },
    ],
    returns: "string",
    unit: "none",
    describe:
      "The first count code points of text: all of it when count is longer, and an empty string when count is 0 or less.",
  }),
  right: rowFunction({
    args: [
      { name: "text", type: "string" },
      { name: "count", type: "integer" },
    ],
    returns: "string",
    unit: "none",
    describe:
      "The last count code points of text: all of it when count is longer, and an empty string when count is 0 or less.",
  }),
  dateDiff: rowFunction({
    args: [
      { name: "start", type: dates },
      { name: "end", type: dates },
      {
        name: "unit",
        type: "string",
        values: ["days", "weeks", "months", "years"],
      },
    ],
    returns: "integer",
    unit: "none",
    describe:
      "The whole units from the date of start to the date of end. Days are calendar days, and weeks are days divided by 7, truncated toward zero. Months are the largest n for which start moved n months, clamped to the month's last day, doesn't pass end (Jan 31 to Feb 28 is 1), and years are months divided by 12, truncated toward zero. When end is before start, the result is minus dateDiff(end, start, unit).",
  }),
  datePart: rowFunction({
    args: [
      { name: "date", type: dates },
      {
        name: "part",
        type: "string",
        values: ["year", "quarter", "month", "week", "weekday", "day"],
      },
    ],
    returns: "integer",
    unit: "none",
    describe:
      "One part of the date: the calendar year, quarter (1 to 4), month (1 to 12), ISO 8601 week number (1 to 53, so Dec 31, 2024 is in week 1 while its year is 2024), weekday (1 for Monday to 7 for Sunday) or day of the month.",
  }),
  dateTrunc: rowFunction({
    args: [
      { name: "date", type: dates },
      {
        name: "unit",
        type: "string",
        values: ["day", "week", "month", "quarter", "year"],
      },
    ],
    returns: "date",
    unit: "none",
    describe:
      "The first day of the unit that contains the date. Weeks start on Monday.",
  }),
  addDays: rowFunction({
    args: [
      { name: "date", type: dates },
      { name: "days", type: "integer" },
    ],
    returns: { like: "date" },
    unit: "none",
    describe:
      "date moved by days calendar days, keeping the wall-clock time of a datetime.",
  }),
  today: rowFunction({
    args: [],
    returns: "date",
    unit: "none",
    describe:
      "The current date in the time zone of the layer that defines the expression: the dataset's for org and team, the viewer's for personal and session.",
  }),
  age: rowFunction({
    args: [{ name: "date", type: dates }],
    returns: "integer",
    unit: "none",
    describe: "dateDiff(date, today(), years).",
  }),
  count: aggregate(
    {
      args: [{ name: "x", type: anyType, optional: true }],
      returns: "integer",
      unit: "none",
      describe:
        "count(x) is the number of rows where x isn't null; count() is the number of rows.",
    },
    ["count"]
  ),
  countIf: aggregate(
    {
      args: [{ name: "condition", type: "boolean" }],
      returns: "integer",
      unit: "none",
      describe: "The number of rows where condition is true.",
    },
    ["count"]
  ),
  sum: aggregate(
    {
      args: [{ name: "x", type: "number" }],
      returns: { like: "x" },
      unit: { like: "x" },
      describe: "The sum of x, or 0 when there are no values.",
    },
    ["sum"]
  ),
  sumIf: aggregate(
    {
      args: [
        { name: "x", type: "number" },
        { name: "condition", type: "boolean" },
      ],
      returns: { like: "x" },
      unit: { like: "x" },
      describe:
        "The sum of x over rows where condition is true, or 0 when there are none.",
    },
    ["sum"]
  ),
  mean: statistic(
    { like: "x" },
    ["count", "mean"],
    "The arithmetic mean of x, or null when there are no values."
  ),
  min: aggregate(
    {
      args: [{ name: "x", type: comparable }],
      returns: { like: "x" },
      unit: { like: "x" },
      describe: "The smallest value of x, or null when there are no values.",
    },
    ["min"]
  ),
  max: aggregate(
    {
      args: [{ name: "x", type: comparable }],
      returns: { like: "x" },
      unit: { like: "x" },
      describe: "The largest value of x, or null when there are no values.",
    },
    ["max"]
  ),
  variance: statistic(
    "none",
    ["count", "mean", "m2"],
    "The sample variance of x (dividing by n - 1), or null with fewer than 2 values."
  ),
  stddev: statistic(
    { like: "x" },
    ["count", "mean", "m2"],
    "The sample standard deviation of x (dividing by n - 1), or null with fewer than 2 values."
  ),
  variancePop: statistic(
    "none",
    ["count", "mean", "m2"],
    "The population variance of x (dividing by n), or null when there are no values."
  ),
  stddevPop: statistic(
    { like: "x" },
    ["count", "mean", "m2"],
    "The population standard deviation of x (dividing by n), or null when there are no values."
  ),
  median: statistic({ like: "x" }, null, "percentile(x, 0.5)."),
  percentile: aggregate(
    {
      args: [
        { name: "x", type: "number" },
        { name: "p", type: "number", constant: true, range: [0, 1] },
      ],
      returns: "number",
      unit: { like: "x" },
      describe:
        "The p quantile of x: with the n values sorted, the value at position p × (n - 1) counting from 0, interpolated linearly between neighbours. Null when there are no values.",
    },
    null
  ),
  mode: pick(
    "The most frequent value of x; on a tie, the smallest, with false before true. Null when there are no values."
  ),
  distinctCount: aggregate(
    {
      args: [{ name: "x", type: anyType }],
      returns: "integer",
      unit: "none",
      describe: "The number of distinct values of x.",
    },
    null
  ),
  first: pick(
    "The value of x in the group's first row with one, in display order. Null when there are no values."
  ),
  last: pick(
    "The value of x in the group's last row with one, in display order. Null when there are no values."
  ),
  rank: ranking(
    "1 plus the number of rows in the partition whose x comes before this row's, largest first unless order is asc. Ties share a rank and leave gaps (1, 2, 2, 4)."
  ),
  denseRank: ranking(
    "1 plus the number of distinct values of x in the partition that come before this row's, largest first unless order is asc. Ties share a rank without gaps (1, 2, 2, 3)."
  ),
  runningSum: windowFunction({
    args: [{ name: "x", type: "number" }],
    returns: { like: "x" },
    unit: { like: "x" },
    describe:
      "The sum of x over the partition's rows up to and including this one, one row at a time in display order, so tied rows get different sums.",
  }),
  share: windowFunction({
    args: [{ name: "x", type: "number" }],
    returns: "number",
    unit: "percent",
    describe:
      "x divided by the sum of x over the partition, or null when that sum is 0.",
  }),
  zScore: windowFunction({
    args: [{ name: "x", type: "number" }],
    returns: "number",
    unit: "none",
    describe:
      "(x - mean) divided by the sample standard deviation over the partition, or null when the deviation is 0 or there are fewer than 2 values.",
  }),
} satisfies Record<string, FunctionDefinition>

export type FunctionName = keyof typeof builtins

export const functionCatalog: {
  /** Rules that hold for every function. */
  readonly rules: readonly string[]
  readonly functions: Readonly<Record<FunctionName, FunctionDefinition>>
} = {
  rules: [
    "Numbers are IEEE 754 doubles, currency included. An integer is a number without a fractional part and is accepted wherever a number is. A number literal without a fractional part is an integer.",
    "A NaN or infinite value, read or computed, is null.",
    "Strings compare and sort by Unicode code point, case included. Lengths and positions count code points.",
    "Dates and datetimes are read in the dataset's time zone, and datetimes have millisecond precision. A date compared with a datetime is the start of that day there.",
    "Arguments joined by like form a group. Their types unify: integer with number gives number, date with datetime gives datetime, and a null literal fits any type. Their units must match, and a value without a unit fits any unit.",
    "A string literal fits a date as YYYY-MM-DD and a datetime as an ISO 8601 date-time with seconds, optional milliseconds, and a Z or ±hh:mm offset. The type checker rejects any other string there.",
    "A number's unit comes only from its dataset field: its currency, percent for a percent field, or a unit the developer declares on the field. Formats never change units. Other numbers and literals have none.",
    "In a product, a factor without a unit takes the other factor's unit, a percent of a unit is that unit (a percent of a price is a price), a percent of a percent is a percent, and two other units fail type checking. In a quotient, dividing by the dividend's own unit, percent included, gives no unit; dividing by a number without a unit or by a percent keeps the dividend's unit; any other divisor with a unit fails type checking.",
    "Arguments of aggregate and window functions are row expressions: they can't contain aggregate or window functions. Row functions can combine aggregates, as in div(sum(a), sum(b)).",
    "A window function's partition is the row's group when the table is grouped, otherwise every row after filters. Display order is the table's current sort, with ties and an unsorted table in the order of the dataset's row key.",
    "Implementations must give these results exactly, except that a floating-point result of an aggregate or window function may differ from the exact result by at most 1e-9 × S. S is the sum of |x| for sum, sumIf, runningSum and share's total; the largest |x| for mean, median, percentile and zScore's mean; and its square for variance and variancePop. Standard deviations may differ by the square root of their variance's allowance. An implementation that can't meet this for a function mustn't compile it, so the function covers loaded rows only.",
  ],
  functions: builtins,
}
