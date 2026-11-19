import { compareOrdered } from "./compare-ordered"

interface Frame {
  readonly a: object
  readonly b: object
  readonly left: readonly unknown[]
  readonly right: readonly unknown[]
  // The result once every child pair is equal: the difference in length.
  readonly tail: number
  index: number
}

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
    return Number.isNaN(a) || Number.isNaN(b)
      ? Number.isNaN(a)
        ? -1
        : 1
      : compareOrdered(a, b)
  }
  if (typeof a === "bigint" && typeof b === "bigint") {
    return compareOrdered(a, b)
  }
  if (typeof a === "string" && typeof b === "string") {
    return compareOrdered(a, b)
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return compareOrdered(a, b)
  }
  return Number.NaN
}

function sortedEntries(value: object): [string, unknown][] {
  return Object.entries(value).sort(([a], [b]) => compareOrdered(a, b))
}

function compareKeys(a: readonly string[], b: readonly string[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const order = compareOrdered(a[index] ?? "", b[index] ?? "")
    if (order !== 0) {
      return order
    }
  }
  return a.length - b.length
}

class Path {
  readonly #pairs = new Map<object, Set<object>>()

  has(a: object, b: object): boolean {
    return this.#pairs.get(a)?.has(b) ?? false
  }

  add(a: object, b: object): void {
    const right = this.#pairs.get(a) ?? new Set()
    right.add(b)
    this.#pairs.set(a, right)
  }

  delete(a: object, b: object): void {
    this.#pairs.get(a)?.delete(b)
  }
}

// A number settles the pair; a frame lists the child pairs still to compare.
function open(a: unknown, b: unknown, path: Path): number | Frame {
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
  if (path.has(a, b)) {
    return 0
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return { a, b, left: a, right: b, tail: a.length - b.length, index: 0 }
  }
  const left = sortedEntries(a)
  const right = sortedEntries(b)
  const keys = compareKeys(
    left.map(([key]) => key),
    right.map(([key]) => key)
  )
  return keys !== 0
    ? keys
    : {
        a,
        b,
        left: left.map(([, value]) => value),
        right: right.map(([, value]) => value),
        tail: 0,
        index: 0,
      }
}

/**
 * Compares two values as data: arrays by their items, plain objects by their
 * keys and values whatever their key order, and scalars by value. It is 0
 * exactly when the two are structurally equal. Values that aren't data, such
 * as functions or class instances, are equal only to themselves and have no
 * order: two different ones compare as NaN. It never throws, whatever the
 * depth, cycles or BigInt values, and takes time linear in the values' size.
 */
export function compareData(a: unknown, b: unknown): number {
  const path = new Path()
  const frames: Frame[] = []
  let next = open(a, b, path)
  for (;;) {
    if (typeof next !== "number") {
      frames.push(next)
      path.add(next.a, next.b)
    } else if (next !== 0) {
      return next
    }
    const frame = frames.at(-1)
    if (!frame) {
      return 0
    }
    if (frame.index < Math.min(frame.left.length, frame.right.length)) {
      const index = frame.index++
      next = open(frame.left[index], frame.right[index], path)
    } else {
      frames.pop()
      path.delete(frame.a, frame.b)
      next = frame.tail
    }
  }
}
