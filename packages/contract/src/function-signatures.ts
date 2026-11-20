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

/** What a type checker needs to know about a built-in function. */
export interface FunctionSignature {
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
}

type Shape = Omit<FunctionSignature, "kind">

const comparable = ["number", "string", "date", "datetime"] as const
const anyType = ["number", "string", "boolean", "date", "datetime"] as const
const dates = ["date", "datetime"] as const

// Without this annotation, bundlers keep every call, and with it the whole
// table, in apps that never read a signature.
/* #__NO_SIDE_EFFECTS__ */
function row(shape: Shape): FunctionSignature {
  return { kind: "row", ...shape }
}

/* #__NO_SIDE_EFFECTS__ */
function aggregate(shape: Shape): FunctionSignature {
  return { kind: "aggregate", ...shape }
}

/* #__NO_SIDE_EFFECTS__ */
function windowFunction(shape: Shape): FunctionSignature {
  return { kind: "window", ...shape }
}

const sameAsA = [
  { name: "a", type: "number" },
  { name: "b", type: { like: "a" } },
] as const

const twoNumbers = [
  { name: "a", type: "number" },
  { name: "b", type: "number" },
] as const

const oneNumber = [{ name: "x", type: "number" }] as const

const comparison = row({
  args: [
    { name: "a", type: comparable },
    { name: "b", type: { like: "a" } },
  ],
  returns: "boolean",
  unit: "none",
})

const equality = row({
  args: [
    { name: "a", type: anyType },
    { name: "b", type: { like: "a" } },
  ],
  returns: "boolean",
  unit: "none",
})

const pairOfComparable = row({
  args: [
    { name: "a", type: comparable },
    { name: "b", type: { like: "a" } },
  ],
  returns: { like: "a" },
  unit: { like: "a" },
})

const sameNumber = row({
  args: oneNumber,
  returns: { like: "x" },
  unit: { like: "x" },
})

const roundedToInteger = row({
  args: oneNumber,
  returns: "integer",
  unit: { like: "x" },
})

const textTest = row({
  args: [
    { name: "text", type: "string" },
    { name: "search", type: "string" },
  ],
  returns: "boolean",
  unit: "none",
})

const textToText = row({
  args: [{ name: "text", type: "string" }],
  returns: "string",
  unit: "none",
})

const textEnd = row({
  args: [
    { name: "text", type: "string" },
    { name: "count", type: "integer" },
  ],
  returns: "string",
  unit: "none",
})

const booleans = row({
  args: [
    { name: "a", type: "boolean" },
    { name: "b", type: "boolean", variadic: true },
  ],
  returns: "boolean",
  unit: "none",
})

const statisticLikeX = aggregate({
  args: oneNumber,
  returns: "number",
  unit: { like: "x" },
})

const statisticWithoutUnit = aggregate({
  args: oneNumber,
  returns: "number",
  unit: "none",
})

const sumOfX = aggregate({
  args: oneNumber,
  returns: { like: "x" },
  unit: { like: "x" },
})

const extreme = aggregate({
  args: [{ name: "x", type: comparable }],
  returns: { like: "x" },
  unit: { like: "x" },
})

const pick = aggregate({
  args: [{ name: "x", type: anyType }],
  returns: { like: "x" },
  unit: { like: "x" },
})

const ranking = windowFunction({
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
})

const signatures = {
  add: row({ args: sameAsA, returns: { like: "a" }, unit: { like: "a" } }),
  sub: row({ args: sameAsA, returns: { like: "a" }, unit: { like: "a" } }),
  mul: row({
    args: twoNumbers,
    returns: { join: ["a", "b"] },
    unit: "product",
  }),
  div: row({ args: twoNumbers, returns: "number", unit: "quotient" }),
  abs: sameNumber,
  round: row({
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
  }),
  floor: roundedToInteger,
  ceil: roundedToInteger,
  min2: pairOfComparable,
  max2: pairOfComparable,
  clamp: row({
    args: [
      { name: "x", type: "number" },
      { name: "low", type: { like: "x" } },
      { name: "high", type: { like: "x" } },
    ],
    returns: { like: "x" },
    unit: { like: "x" },
  }),
  percentChange: row({
    args: [
      { name: "from", type: "number" },
      { name: "to", type: { like: "from" } },
    ],
    returns: "number",
    unit: "percent",
  }),
  if: row({
    args: [
      { name: "condition", type: "boolean" },
      { name: "then", type: anyType },
      { name: "else", type: { like: "then" } },
    ],
    returns: { like: "then" },
    unit: { like: "then" },
  }),
  and: booleans,
  or: booleans,
  not: row({
    args: [{ name: "x", type: "boolean" }],
    returns: "boolean",
    unit: "none",
  }),
  eq: equality,
  neq: equality,
  gt: comparison,
  gte: comparison,
  lt: comparison,
  lte: comparison,
  between: row({
    args: [
      { name: "x", type: comparable },
      { name: "low", type: { like: "x" } },
      { name: "high", type: { like: "x" } },
    ],
    returns: "boolean",
    unit: "none",
  }),
  in: row({
    args: [
      { name: "x", type: anyType },
      { name: "values", type: { like: "x" }, variadic: true },
    ],
    returns: "boolean",
    unit: "none",
  }),
  isNull: row({
    args: [{ name: "x", type: anyType }],
    returns: "boolean",
    unit: "none",
  }),
  coalesce: row({
    args: [
      { name: "x", type: anyType },
      { name: "fallbacks", type: { like: "x" }, variadic: true },
    ],
    returns: { like: "x" },
    unit: { like: "x" },
  }),
  concat: row({
    args: [
      { name: "a", type: "string" },
      { name: "b", type: "string", variadic: true },
    ],
    returns: "string",
    unit: "none",
  }),
  lower: textToText,
  upper: textToText,
  length: row({
    args: [{ name: "text", type: "string" }],
    returns: "integer",
    unit: "none",
  }),
  contains: textTest,
  startsWith: textTest,
  left: textEnd,
  right: textEnd,
  dateDiff: row({
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
  }),
  datePart: row({
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
  }),
  dateTrunc: row({
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
  }),
  addDays: row({
    args: [
      { name: "date", type: dates },
      { name: "days", type: "integer" },
    ],
    returns: { like: "date" },
    unit: "none",
  }),
  today: row({ args: [], returns: "date", unit: "none" }),
  age: row({
    args: [{ name: "date", type: dates }],
    returns: "integer",
    unit: "none",
  }),
  count: aggregate({
    args: [{ name: "x", type: anyType, optional: true }],
    returns: "integer",
    unit: "none",
  }),
  countIf: aggregate({
    args: [{ name: "condition", type: "boolean" }],
    returns: "integer",
    unit: "none",
  }),
  sum: sumOfX,
  sumIf: aggregate({
    args: [
      { name: "x", type: "number" },
      { name: "condition", type: "boolean" },
    ],
    returns: { like: "x" },
    unit: { like: "x" },
  }),
  mean: statisticLikeX,
  min: extreme,
  max: extreme,
  variance: statisticWithoutUnit,
  stddev: statisticLikeX,
  variancePop: statisticWithoutUnit,
  stddevPop: statisticLikeX,
  median: statisticLikeX,
  percentile: aggregate({
    args: [
      { name: "x", type: "number" },
      { name: "p", type: "number", constant: true, range: [0, 1] },
    ],
    returns: "number",
    unit: { like: "x" },
  }),
  mode: pick,
  distinctCount: aggregate({
    args: [{ name: "x", type: anyType }],
    returns: "integer",
    unit: "none",
  }),
  first: pick,
  last: pick,
  rank: ranking,
  denseRank: ranking,
  runningSum: windowFunction({
    args: oneNumber,
    returns: { like: "x" },
    unit: { like: "x" },
  }),
  share: windowFunction({
    args: oneNumber,
    returns: "number",
    unit: "percent",
  }),
  zScore: windowFunction({ args: oneNumber, returns: "number", unit: "none" }),
} satisfies Record<string, FunctionSignature>

export type FunctionName = keyof typeof signatures

/** The kind, arguments, return type and unit of every built-in function. */
export const functionSignatures: Readonly<
  Record<FunctionName, FunctionSignature>
> = signatures
