import { describe, expect, it } from "vitest"

import { compareData } from "./compare-data"

function nested(depth: number, leaf: unknown): unknown {
  let value: unknown = leaf
  for (let level = 0; level < depth; level++) {
    value = level % 2 === 0 ? [value] : { next: value }
  }
  return value
}

// Date.now() is coarse, so each sample averages runs over at least 50 ms.
function fastest(run: () => void): number {
  let best = Infinity
  for (let sample = 0; sample < 3; sample++) {
    const start = Date.now()
    let runs = 0
    while (Date.now() - start < 50) {
      run()
      runs++
    }
    best = Math.min(best, (Date.now() - start) / runs)
  }
  return best
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

  // Comparing 4n levels against n: linear work grows about 4 times.
  it("compares nested values in linear time", () => {
    const small = [nested(25_000, 1), nested(25_000, 1)] as const
    const large = [nested(100_000, 1), nested(100_000, 1)] as const
    let ratio = Infinity
    for (let attempt = 0; attempt < 3 && ratio >= 8; attempt++) {
      ratio =
        fastest(() => compareData(...large)) /
        fastest(() => compareData(...small))
    }
    expect(ratio).toBeLessThan(8)
  })
})
