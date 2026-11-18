type Pair = readonly [object, object]

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function rankOf(value: unknown): number {
  if (value === undefined) {
    return 0
  }
  if (value === null) {
    return 1
  }
  switch (typeof value) {
    case "boolean":
      return 2
    case "number":
      return 3
    case "bigint":
      return 4
    case "string":
      return 5
    case "object":
      return Array.isArray(value) ? 6 : isPlainObject(value) ? 7 : 8
    default:
      return 8
  }
}

function compareScalars(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) || Number.isNaN(b)) {
      return Number.isNaN(a) ? -1 : 1
    }
  }
  if (
    (typeof a === "number" && typeof b === "number") ||
    (typeof a === "bigint" && typeof b === "bigint") ||
    (typeof a === "string" && typeof b === "string") ||
    (typeof a === "boolean" && typeof b === "boolean")
  ) {
    return a < b ? -1 : a > b ? 1 : 0
  }
  return Number.NaN
}

function compareLists(
  a: readonly unknown[],
  b: readonly unknown[],
  stack: Pair[]
): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const order = compareWith(a[index], b[index], stack)
    if (order !== 0) {
      return order
    }
  }
  return a.length - b.length
}

function sortedEntries(value: object): [string, unknown][] {
  return Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
}

function compareWith(a: unknown, b: unknown, stack: Pair[]): number {
  if (Object.is(a, b)) {
    return 0
  }
  const rank = rankOf(a)
  if (rank !== rankOf(b)) {
    return rank - rankOf(b)
  }
  if (
    (rank !== 6 && rank !== 7) ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return compareScalars(a, b)
  }
  // A pair already being compared is assumed equal, which ends a cycle.
  if (stack.some(([x, y]) => x === a && y === b)) {
    return 0
  }
  stack.push([a, b])
  const order =
    Array.isArray(a) && Array.isArray(b)
      ? compareLists(a, b, stack)
      : compareEntries(sortedEntries(a), sortedEntries(b), stack)
  stack.pop()
  return order
}

function compareEntries(
  a: readonly [string, unknown][],
  b: readonly [string, unknown][],
  stack: Pair[]
): number {
  const keys = compareLists(
    a.map(([key]) => key),
    b.map(([key]) => key),
    stack
  )
  return keys !== 0
    ? keys
    : compareLists(
        a.map(([, value]) => value),
        b.map(([, value]) => value),
        stack
      )
}

/**
 * Compares two values as data: arrays by their items, plain objects by their
 * keys and values whatever their key order, and scalars by value. It is 0
 * exactly when the two are structurally equal. Values that aren't data, such
 * as functions or class instances, are equal only to themselves and have no
 * order: two different ones compare as NaN. Cycles and BigInt never throw.
 */
export function compareData(a: unknown, b: unknown): number {
  return compareWith(a, b, [])
}
