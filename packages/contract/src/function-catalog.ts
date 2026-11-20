import {
  functionSignatures,
  type FunctionName,
  type FunctionSignature,
} from "./function-signatures"

type Summary = "count" | "sum" | "mean" | "m2" | "min" | "max"

/**
 * The shape of a built-in function. Functions registered under a namespace
 * (`acme:gpa`) get their own registration API.
 */
export interface FunctionDefinition extends FunctionSignature {
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

// Without this annotation, bundlers keep every call, and with it every
// description, in apps that import only `functionSignatures`.
/* #__NO_SIDE_EFFECTS__ */
function define(
  signature: FunctionSignature,
  nulls: FunctionDefinition["nulls"],
  mergeable: FunctionDefinition["mergeable"],
  describe: string
): FunctionDefinition {
  return { ...signature, nulls, mergeable, describe }
}

/* #__NO_SIDE_EFFECTS__ */
function rowFunction(
  signature: FunctionSignature,
  describe: string,
  nulls: "propagate" | "custom" = "propagate"
): FunctionDefinition {
  return define(signature, nulls, null, describe)
}

/* #__NO_SIDE_EFFECTS__ */
function aggregate(
  signature: FunctionSignature,
  mergeable: readonly Summary[] | null,
  describe: string
): FunctionDefinition {
  return define(signature, "skip", mergeable, describe)
}

/* #__NO_SIDE_EFFECTS__ */
function windowFunction(
  signature: FunctionSignature,
  describe: string
): FunctionDefinition {
  return define(signature, "skip", null, describe)
}

const builtins = {
  add: rowFunction(functionSignatures.add, "a plus b."),
  sub: rowFunction(functionSignatures.sub, "a minus b."),
  mul: rowFunction(functionSignatures.mul, "a times b."),
  div: rowFunction(
    functionSignatures.div,
    "a divided by b, or null when b is 0."
  ),
  abs: rowFunction(functionSignatures.abs, "The absolute value of x."),
  round: rowFunction(
    functionSignatures.round,
    "x rounded to digits decimal places, halves away from zero, applied to the shortest decimal that represents x, so round(1.005, 2) is 1.01."
  ),
  floor: rowFunction(
    functionSignatures.floor,
    "The largest integer not greater than x."
  ),
  ceil: rowFunction(
    functionSignatures.ceil,
    "The smallest integer not less than x."
  ),
  min2: rowFunction(
    functionSignatures.min2,
    "The smaller of a and b, or null when either is null."
  ),
  max2: rowFunction(
    functionSignatures.max2,
    "The larger of a and b, or null when either is null."
  ),
  clamp: rowFunction(
    functionSignatures.clamp,
    "x limited to the range from low to high, or null when low is greater than high."
  ),
  percentChange: rowFunction(
    functionSignatures.percentChange,
    "(to - from) divided by the absolute value of from, so a rise is positive even from a negative base. Null when from is 0."
  ),
  if: rowFunction(
    functionSignatures.if,
    "then when condition is true, otherwise else. A null condition picks else.",
    "custom"
  ),
  and: rowFunction(
    functionSignatures.and,
    "True when every argument is true. False when any is false, even if others are null; otherwise null.",
    "custom"
  ),
  or: rowFunction(
    functionSignatures.or,
    "True when any argument is true, even if others are null. False when every one is false; otherwise null.",
    "custom"
  ),
  not: rowFunction(
    functionSignatures.not,
    "True when x is false, false when x is true."
  ),
  eq: rowFunction(functionSignatures.eq, "True when a equals b."),
  neq: rowFunction(functionSignatures.neq, "True when a doesn't equal b."),
  gt: rowFunction(functionSignatures.gt, "True when a is greater than b."),
  gte: rowFunction(
    functionSignatures.gte,
    "True when a is greater than or equal to b."
  ),
  lt: rowFunction(functionSignatures.lt, "True when a is less than b."),
  lte: rowFunction(
    functionSignatures.lte,
    "True when a is less than or equal to b."
  ),
  between: rowFunction(
    functionSignatures.between,
    "True when x is from low to high, both included. False when low is greater than high."
  ),
  in: rowFunction(
    functionSignatures.in,
    "True when x equals one of values, otherwise false. Null when x is null; null values never match. Takes at most 15 values, by the 16-argument limit.",
    "custom"
  ),
  isNull: rowFunction(
    functionSignatures.isNull,
    "True when x is null, otherwise false.",
    "custom"
  ),
  coalesce: rowFunction(
    functionSignatures.coalesce,
    "The first argument that isn't null, or null when all are.",
    "custom"
  ),
  concat: rowFunction(
    functionSignatures.concat,
    "The arguments joined into one string, with null arguments as empty strings. Never null.",
    "custom"
  ),
  lower: rowFunction(
    functionSignatures.lower,
    "text in lowercase, by Unicode's default case mapping."
  ),
  upper: rowFunction(
    functionSignatures.upper,
    "text in uppercase, by Unicode's default case mapping."
  ),
  length: rowFunction(
    functionSignatures.length,
    "The number of code points in text."
  ),
  contains: rowFunction(
    functionSignatures.contains,
    "True when search occurs in text."
  ),
  startsWith: rowFunction(
    functionSignatures.startsWith,
    "True when text starts with search."
  ),
  left: rowFunction(
    functionSignatures.left,
    "The first count code points of text: all of it when count is longer, and an empty string when count is 0 or less."
  ),
  right: rowFunction(
    functionSignatures.right,
    "The last count code points of text: all of it when count is longer, and an empty string when count is 0 or less."
  ),
  dateDiff: rowFunction(
    functionSignatures.dateDiff,
    "The whole units from the date of start to the date of end. Days are calendar days, and weeks are days divided by 7, truncated toward zero. Months are the largest n for which start moved n months, clamped to the month's last day, doesn't pass end (Jan 31 to Feb 28 is 1), and years are months divided by 12, truncated toward zero. When end is before start, the result is minus dateDiff(end, start, unit)."
  ),
  datePart: rowFunction(
    functionSignatures.datePart,
    "One part of the date: the calendar year, quarter (1 to 4), month (1 to 12), ISO 8601 week number (1 to 53, so Dec 31, 2024 is in week 1 while its year is 2024), weekday (1 for Monday to 7 for Sunday) or day of the month."
  ),
  dateTrunc: rowFunction(
    functionSignatures.dateTrunc,
    "The first day of the unit that contains the date. Weeks start on Monday."
  ),
  addDays: rowFunction(
    functionSignatures.addDays,
    "date moved by days calendar days, keeping the wall-clock time of a datetime."
  ),
  today: rowFunction(
    functionSignatures.today,
    "The current date in the time zone of the layer that defines the expression: the dataset's for org and team, the viewer's for personal and session."
  ),
  age: rowFunction(functionSignatures.age, "dateDiff(date, today(), years)."),
  count: aggregate(
    functionSignatures.count,
    ["count"],
    "count(x) is the number of rows where x isn't null; count() is the number of rows."
  ),
  countIf: aggregate(
    functionSignatures.countIf,
    ["count"],
    "The number of rows where condition is true."
  ),
  sum: aggregate(
    functionSignatures.sum,
    ["sum"],
    "The sum of x, or 0 when there are no values."
  ),
  sumIf: aggregate(
    functionSignatures.sumIf,
    ["sum"],
    "The sum of x over rows where condition is true, or 0 when there are none."
  ),
  mean: aggregate(
    functionSignatures.mean,
    ["count", "mean"],
    "The arithmetic mean of x, or null when there are no values."
  ),
  min: aggregate(
    functionSignatures.min,
    ["min"],
    "The smallest value of x, or null when there are no values."
  ),
  max: aggregate(
    functionSignatures.max,
    ["max"],
    "The largest value of x, or null when there are no values."
  ),
  variance: aggregate(
    functionSignatures.variance,
    ["count", "mean", "m2"],
    "The sample variance of x (dividing by n - 1), or null with fewer than 2 values."
  ),
  stddev: aggregate(
    functionSignatures.stddev,
    ["count", "mean", "m2"],
    "The sample standard deviation of x (dividing by n - 1), or null with fewer than 2 values."
  ),
  variancePop: aggregate(
    functionSignatures.variancePop,
    ["count", "mean", "m2"],
    "The population variance of x (dividing by n), or null when there are no values."
  ),
  stddevPop: aggregate(
    functionSignatures.stddevPop,
    ["count", "mean", "m2"],
    "The population standard deviation of x (dividing by n), or null when there are no values."
  ),
  median: aggregate(functionSignatures.median, null, "percentile(x, 0.5)."),
  percentile: aggregate(
    functionSignatures.percentile,
    null,
    "The p quantile of x: with the n values sorted, the value at position p × (n - 1) counting from 0, interpolated linearly between neighbours. Null when there are no values."
  ),
  mode: aggregate(
    functionSignatures.mode,
    null,
    "The most frequent value of x; on a tie, the smallest, with false before true. Null when there are no values."
  ),
  distinctCount: aggregate(
    functionSignatures.distinctCount,
    null,
    "The number of distinct values of x."
  ),
  first: aggregate(
    functionSignatures.first,
    null,
    "The value of x in the group's first row with one, in display order. Null when there are no values."
  ),
  last: aggregate(
    functionSignatures.last,
    null,
    "The value of x in the group's last row with one, in display order. Null when there are no values."
  ),
  rank: windowFunction(
    functionSignatures.rank,
    "1 plus the number of rows in the partition whose x comes before this row's, largest first unless order is asc. Ties share a rank and leave gaps (1, 2, 2, 4)."
  ),
  denseRank: windowFunction(
    functionSignatures.denseRank,
    "1 plus the number of distinct values of x in the partition that come before this row's, largest first unless order is asc. Ties share a rank without gaps (1, 2, 2, 3)."
  ),
  runningSum: windowFunction(
    functionSignatures.runningSum,
    "The sum of x over the partition's rows up to and including this one, one row at a time in display order, so tied rows get different sums."
  ),
  share: windowFunction(
    functionSignatures.share,
    "x divided by the sum of x over the partition, or null when that sum is 0."
  ),
  zScore: windowFunction(
    functionSignatures.zScore,
    "(x - mean) divided by the sample standard deviation over the partition, or null when the deviation is 0 or there are fewer than 2 values."
  ),
} satisfies Record<FunctionName, FunctionDefinition>

export const functionCatalog: {
  /** Rules that hold for every function. */
  readonly rules: readonly string[]
  readonly functions: Readonly<Record<FunctionName, FunctionDefinition>>
} = {
  rules: [
    "Numbers are IEEE 754 doubles, currency included, and calculations use the full value. A currency value is displayed rounded to its format's decimals, or to its currency's minor units (2 for USD, 0 for JPY) when decimals isn't set. An integer is a number without a fractional part and is accepted wherever a number is. A number literal without a fractional part is an integer.",
    "A NaN or infinite value, read or computed, is null.",
    "Functions compare strings by Unicode code point, case included, as in eq, lt, gt, contains, startsWith, in, min and max. Lengths and positions count code points. Table sorting with setSort is separate and uses locale-aware collation.",
    "Dates and datetimes are read in the dataset's time zone, and datetimes have millisecond precision. A date compared with a datetime is the start of that day there.",
    "Arguments joined by like form a group. Their types unify: integer with number gives number, date with datetime gives datetime, and a null literal fits any type. Their units must match, and a value without a unit fits any unit.",
    "A string literal fits a date as YYYY-MM-DD and a datetime as an ISO 8601 date-time with seconds, optional milliseconds, and a Z or ±hh:mm offset. The type checker rejects any other string there.",
    "A number's unit comes only from its dataset field: its currency, percent for a percent field, or a unit the developer declares on the field. Formats never change units. Other numbers and literals have none.",
    "In a product, a factor without a unit takes the other factor's unit, a percent of a unit is that unit (a percent of a price is a price), a percent of a percent is a percent, and two other units fail type checking. In a quotient, dividing by the dividend's own unit, percent included, gives no unit; dividing by a number without a unit or by a percent keeps the dividend's unit; any other divisor with a unit fails type checking.",
    "Arguments of aggregate and window functions are row expressions: they can't contain aggregate or window functions. Row functions can combine aggregates, as in div(sum(a), sum(b)).",
    "Every dataset has a row key: the table's getRowId, or else its field named id. A table whose dataset has neither fails to load with an error.",
    "A window function's partition is the row's group when the table is grouped, otherwise every row after filters. Display order is the table's current sort, with ties and an unsorted table in ascending order of the row key, compared by code point.",
    "Implementations must give these results exactly, except for the floating-point results of aggregate and window functions, which must be within the allowances of the next rule at any number of rows. An implementation that can't meet a function's semantics or allowance mustn't compile it, so the function covers loaded rows only.",
    "With M the largest |x|, D the largest |x - mean| and A the sum of |x| over the values involved, a result may differ from the exact one by: 1e-9 × A for sum, sumIf and runningSum; 1e-9 × M for mean, median and percentile; V = 1e-9 × M × (D + 1e-9 × M) for variance and variancePop; S = the smaller of √V and V ÷ σ for stddev and stddevPop, or √V when σ is 0, with σ the exact deviation; 1e-9 × A × max(|x|, |T|) ÷ T² for share, with x the row's value and T the exact total, and any value or null when 1e-9 × A is more than |T| ÷ 2; and (1e-9 × M + |z| × S) ÷ (σ - S) for zScore, with z the exact score, and any value or null when S is at least σ ÷ 2. Plain accumulation meets these up to about 9 million values; beyond that, every aggregate (sums, means and variances) must use pairwise or compensated accumulation.",
  ],
  functions: builtins,
}
