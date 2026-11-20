import { describe, expect, it } from "vitest"

import { compareData } from "./compare-data"

function nested(depth: number, leaf: unknown): unknown {
  let value: unknown = leaf
  for (let level = 0; level < depth; level++) {
    value = level % 2 === 0 ? [value] : { next: value }
  }
  return value
}

// Counts every read compareData makes, so linearity is measured in steps,
// not time.
function countedNested(depth: number) {
  let reads = 0
  const handler: ProxyHandler<object> = {
    get(target, key, receiver) {
      reads++
      const value: unknown = Reflect.get(target, key, receiver)
      return value
    },
    ownKeys(target) {
      reads++
      return Reflect.ownKeys(target)
    },
  }
  let value: unknown = 1
  for (let level = 0; level < depth; level++) {
    value = new Proxy(level % 2 === 0 ? [value] : { next: value }, handler)
  }
  return { value, reads: () => reads }
}

function readsToCompare(depth: number): number {
  const a = countedNested(depth)
  const b = countedNested(depth)
  compareData(a.value, b.value)
  return a.reads() + b.reads()
}

describe("compareData", () => {
  it("compares plain data structurally, whatever the key order", () => {
    expect(compareData({ a: 1, b: [1, "x"] }, { b: [1, "x"], a: 1 })).toBe(0)
    expect(compareData({ a: 1 }, { a: 2 })).toBeLessThan(0)
    expect(compareData({ a: 1 }, { a: 1, b: 1 })).toBeLessThan(0)
    expect(compareData([1, 2], [1])).toBeGreaterThan(0)
    expect(compareData(-0, 0)).toBe(0)
  })

  it("orders values of different types by type", () => {
    const values = [undefined, null, false, 0, 0n, "", [], {}]
    values.forEach((value, index) => {
      values.slice(index + 1).forEach((later) => {
        expect(compareData(value, later)).toBeLessThan(0)
        expect(compareData(later, value)).toBeGreaterThan(0)
      })
    })
  })

  it("sorts NaN before every other number", () => {
    expect(compareData(Number.NaN, -Infinity)).toBeLessThan(0)
    expect(compareData({ n: 1 }, { n: Number.NaN })).toBeGreaterThan(0)
  })

  it("compares BigInt without throwing", () => {
    expect(compareData({ n: 1n }, { n: 1n })).toBe(0)
    expect(compareData({ n: 1n }, { n: 2n })).toBeLessThan(0)
  })

  it("compares cycles without throwing", () => {
    const a: Record<string, unknown> = { id: "x" }
    a["self"] = a
    const b: Record<string, unknown> = { id: "x" }
    b["self"] = b
    const c: Record<string, unknown> = { id: "y" }
    c["self"] = c

    expect(compareData(a, b)).toBe(0)
    expect(compareData(a, c)).toBeLessThan(0)
  })

  it("leaves values that aren't data unordered unless they're the same", () => {
    const run = () => undefined
    expect(compareData(run, run)).toBe(0)
    expect(compareData(run, () => undefined)).toBeNaN()
    expect(compareData(new Date(0), new Date(0))).toBeNaN()
    expect(compareData([Symbol("a")], [Symbol("a")])).toBeNaN()
  })

  it("compares deeply nested values without throwing", () => {
    expect(compareData(nested(100_000, 1), nested(100_000, 1))).toBe(0)
    expect(compareData(nested(100_000, 1), nested(100_000, 2))).toBeLessThan(0)
    expect(compareData(nested(100_000, 1), nested(99_999, 1))).not.toBe(0)
  })

  // Comparing 4n levels against n: linear work reads about 4 times as much,
  // quadratic work about 16 times.
  it("compares nested values in linear steps", () => {
    const ratio = readsToCompare(100_000) / readsToCompare(25_000)

    expect(ratio).toBeGreaterThan(3)
    expect(ratio).toBeLessThan(5)
  })
})
